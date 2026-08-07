using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S3+ ruling under test: an update NEVER fails because of season resolution.
// When the driving date changed: Resolved -> new SeasonId; NoCoveringSeason -> null
// (+ "SeasonUnstamped" notice ONLY on a non-null -> null transition, never null -> null);
// Ambiguous -> null + the existing AmbiguousSeason notice. An update that does not touch
// the driving date must not consult the resolver at all. A thrown resolver leaves
// SeasonId unchanged (unlike create's null) and the save proceeds. Match-date edits
// cascade to the match's lineup (team matches only) — silently, no Version bump, no
// audit row, even when Published.
public class SeasonRestampingTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonRestampingTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed class Fixture
    {
        public int TeamId;
        public int SeasonAId, SeasonBId, SeasonOverlap1Id, SeasonOverlap2Id;
        public int RosteredPlayerId;
        public int PeriodId;
        public string CoachId = "";
    }

    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

    // Dates used throughout: two inside season A, one inside season B, two covered by
    // no season at all, one inside the deliberate 2032 overlap (ambiguous).
    private const string InA1 = "2030-03-15T00:00:00Z";
    private const string InA2 = "2030-04-20T00:00:00Z";
    private const string InB = "2031-03-01T00:00:00Z";
    private const string Off1 = "2029-05-05T00:00:00Z";
    private const string Off2 = "2029-06-06T00:00:00Z";
    private const string Amb = "2032-08-01T00:00:00Z";

    private async Task<Fixture> ArrangeAsync(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var f = new Fixture();
        var ownerId = (await db.Users.FirstAsync(u => u.Email == TestAuth.SoccerCoachEmail)).Id;
        f.CoachId = ownerId;

        var existing = await db.Teams.FirstOrDefaultAsync(t => t.Name == "STR United");
        if (existing == null)
        {
            var team = new Team { Name = "STR United", SportId = 1, CoachId = ownerId };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = ownerId, TeamId = team.Id });

            Season Mk(string name, DateTime start, DateTime end, SeasonStatus status)
            {
                var s = new Season { OwnerId = ownerId, Name = name, StartDate = start, EndDate = end, Status = status };
                s.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
                db.Seasons.Add(s);
                return s;
            }

            var sA = Mk("STR 2030", D(2030, 1, 1), D(2030, 6, 30), SeasonStatus.Active);
            var sB = Mk("STR 2031", D(2031, 1, 1), D(2031, 12, 31), SeasonStatus.Active);
            Mk("STR Overlap 1", D(2032, 1, 1), D(2032, 12, 31), SeasonStatus.Active);
            Mk("STR Overlap 2", D(2032, 6, 1), D(2033, 5, 31), SeasonStatus.Draft);
            await db.SaveChangesAsync();

            var player = new Player { FullName = "STR Rostered", Age = 20, SportId = 1, PositionId = 1, TeamId = team.Id };
            db.Players.Add(player);
            await db.SaveChangesAsync();

            // Rostered in seasons A and B — so a player-context date move A -> B lands
            // in a different season through SeasonRoster, and 2029 dates land nowhere.
            db.SeasonRosters.AddRange(
                new SeasonRoster { PlayerId = player.Id, SeasonId = sA.Id, TeamId = team.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 6, 30) },
                new SeasonRoster { PlayerId = player.Id, SeasonId = sB.Id, TeamId = team.Id, JoinedAt = D(2031, 1, 1), LeftAt = D(2031, 12, 31) });

            db.AssessmentPeriods.Add(new AssessmentPeriod
            {
                Name = "STR Period",
                TeamId = team.Id,
                StartDate = D(2029, 1, 1),
                EndDate = D(2035, 12, 31),
            });
            await db.SaveChangesAsync();
        }

        f.TeamId = (await db.Teams.SingleAsync(t => t.Name == "STR United")).Id;
        f.SeasonAId = (await db.Seasons.SingleAsync(s => s.Name == "STR 2030")).Id;
        f.SeasonBId = (await db.Seasons.SingleAsync(s => s.Name == "STR 2031")).Id;
        f.SeasonOverlap1Id = (await db.Seasons.SingleAsync(s => s.Name == "STR Overlap 1")).Id;
        f.SeasonOverlap2Id = (await db.Seasons.SingleAsync(s => s.Name == "STR Overlap 2")).Id;
        f.RosteredPlayerId = (await db.Players.SingleAsync(p => p.FullName == "STR Rostered")).Id;
        f.PeriodId = (await db.AssessmentPeriods.SingleAsync(p => p.Name == "STR Period")).Id;
        return f;
    }

    private sealed class DtoWithNotice
    {
        public int Id { get; set; }
        public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    }

    private static async Task<DtoWithNotice> ReadDtoAsync(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<DtoWithNotice>>())!.Data!;
    }

    private static void AssertUnstampNotice(SeasonResolutionNoticeDto? notice)
    {
        Assert.NotNull(notice);
        Assert.Equal("SeasonUnstamped", notice!.Code);
        Assert.Empty(notice.CandidateSeasonIds);
    }

    private ClaimsPrincipal CoachPrincipal(Fixture f) => new(new ClaimsIdentity(new[]
    {
        new Claim(ClaimTypes.NameIdentifier, f.CoachId),
        new Claim(ClaimTypes.Role, "Coach"),
    }, "Test"));

    // ── Test doubles ─────────────────────────────────────────────────────────

    // Any call at all is the failure being asserted — returns are never meaningful.
    private sealed class RecordingStamper : ISeasonStamper
    {
        public int CreateCalls, RestampTeamCalls, RestampPlayerCalls;
        public Task<SeasonStamp> ForTeamAsync(int teamId, DateOnly date)
        { CreateCalls++; return Task.FromResult(default(SeasonStamp)); }
        public Task<SeasonStamp> ForPlayerAsync(int playerId, DateOnly date)
        { CreateCalls++; return Task.FromResult(default(SeasonStamp)); }
        public Task<SeasonRestamp> RestampForTeamAsync(int teamId, DateOnly date, int? currentSeasonId)
        { RestampTeamCalls++; return Task.FromResult(new SeasonRestamp(null, null)); }
        public Task<SeasonRestamp> RestampForPlayerAsync(int playerId, DateOnly date, int? currentSeasonId)
        { RestampPlayerCalls++; return Task.FromResult(new SeasonRestamp(null, null)); }
        public int TotalCalls => CreateCalls + RestampTeamCalls + RestampPlayerCalls;
    }

    private sealed class ThrowingResolver : ISeasonResolver
    {
        public Task<SeasonResolution> ResolveForTeamAsync(int teamId, DateOnly date) =>
            throw new InvalidOperationException("resolver exploded");
        public Task<SeasonResolution> ResolveForPlayerAsync(int playerId, DateOnly date) =>
            throw new InvalidOperationException("resolver exploded");
    }

    private sealed class FixedResolver : ISeasonResolver
    {
        public SeasonResolution Next;
        public Task<SeasonResolution> ResolveForTeamAsync(int teamId, DateOnly date) => Task.FromResult(Next);
        public Task<SeasonResolution> ResolveForPlayerAsync(int playerId, DateOnly date) => Task.FromResult(Next);
    }

    private static ISeasonStamper ThrowingStamper() =>
        new SeasonStamper(new ThrowingResolver(), NullLogger<SeasonStamper>.Instance);

    // ── Stamper unit: outcome -> restamp mapping and the notice rules ────────

    [Fact]
    public async Task Restamp_maps_outcomes_with_unstamp_notice_only_on_nonnull_to_null()
    {
        var resolver = new FixedResolver();
        var stamper = new SeasonStamper(resolver, NullLogger<SeasonStamper>.Instance);
        var day = new DateOnly(2030, 3, 15);

        resolver.Next = SeasonResolution.Resolved(7);
        var resolved = await stamper.RestampForTeamAsync(1, day, 3);
        Assert.Equal(7, resolved.SeasonId);
        Assert.Null(resolved.Notice);

        resolver.Next = SeasonResolution.NoCoveringSeason();
        var unstamped = await stamper.RestampForTeamAsync(1, day, 3);
        Assert.Null(unstamped.SeasonId);
        AssertUnstampNotice(unstamped.Notice);

        var stillNull = await stamper.RestampForPlayerAsync(1, day, null);
        Assert.Null(stillNull.SeasonId);
        Assert.Null(stillNull.Notice); // null -> null is silent

        resolver.Next = SeasonResolution.Ambiguous(new[] { 2, 5 });
        var ambiguous = await stamper.RestampForPlayerAsync(1, day, 3);
        Assert.Null(ambiguous.SeasonId);
        Assert.Equal("AmbiguousSeason", ambiguous.Notice!.Code);
        Assert.Equal(new List<int> { 2, 5 }, ambiguous.Notice.CandidateSeasonIds);
    }

    [Fact]
    public async Task Restamp_keeps_current_season_when_resolver_throws()
    {
        var stamper = ThrowingStamper();

        var team = await stamper.RestampForTeamAsync(1, new DateOnly(2030, 3, 15), 42);
        Assert.Equal(42, team.SeasonId);
        Assert.Null(team.Notice);

        var player = await stamper.RestampForPlayerAsync(1, new DateOnly(2030, 3, 15), 42);
        Assert.Equal(42, player.SeasonId);
        Assert.Null(player.Notice);
    }

    // ── Path 1: team match — full journey over one record ────────────────────

    [Fact]
    public async Task Team_match_update_restamps_across_seasons_and_unstamps_with_notice()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        object Body(string date) => new
        { opponentName = "Restamp FC", matchDate = date, homeScore = 2, awayScore = 1, isHome = true };

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/matches", Body(InA1)));
        Assert.Equal(f.SeasonAId, (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        // Moved within the same season -> same SeasonId, no notice.
        var sameSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/matches/{created.Id}", Body(InA2)));
        Assert.Null(sameSeason.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        // Moved to a different season -> new SeasonId, no notice.
        var otherSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/matches/{created.Id}", Body(InB)));
        Assert.Null(otherSeason.SeasonNotice);
        Assert.Equal(f.SeasonBId, (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        // Moved outside all seasons -> null + SeasonUnstamped notice.
        var unstamped = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/matches/{created.Id}", Body(Off1)));
        AssertUnstampNotice(unstamped.SeasonNotice);
        Assert.Null((await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        // Already null, still outside all seasons -> null, NO notice.
        var stillNull = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/matches/{created.Id}", Body(Off2)));
        Assert.Null(stillNull.SeasonNotice);
        Assert.Null((await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);
    }

    [Fact]
    public async Task Team_match_update_into_overlap_gets_ambiguous_notice()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/matches", new
        { opponentName = "Restamp Amb FC", matchDate = InA1, homeScore = 1, awayScore = 1, isHome = false }));

        var updated = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/matches/{created.Id}", new
        { opponentName = "Restamp Amb FC", matchDate = Amb, homeScore = 1, awayScore = 1, isHome = false }));
        Assert.NotNull(updated.SeasonNotice);
        Assert.Equal("AmbiguousSeason", updated.SeasonNotice!.Code);
        Assert.Equal(
            new[] { f.SeasonOverlap1Id, f.SeasonOverlap2Id }.OrderBy(id => id).ToList(),
            updated.SeasonNotice.CandidateSeasonIds);
        Assert.Null((await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);
    }

    // ── Path 3: assessment — player context via SeasonRoster ─────────────────

    [Fact]
    public async Task Assessment_update_restamps_via_roster()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        object Body(string date) => new
        { playerId = f.RosteredPlayerId, assessmentPeriodId = f.PeriodId, dateRecorded = date, statScores = Array.Empty<object>() };

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync("/api/player-assessments", Body(InA1)));
        Assert.Equal(f.SeasonAId, (await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == created.Id)).SeasonId);

        var sameSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/player-assessments/{created.Id}", Body(InA2)));
        Assert.Null(sameSeason.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == created.Id)).SeasonId);

        var otherSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/player-assessments/{created.Id}", Body(InB)));
        Assert.Null(otherSeason.SeasonNotice);
        Assert.Equal(f.SeasonBId, (await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == created.Id)).SeasonId);

        var unstamped = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/player-assessments/{created.Id}", Body(Off1)));
        AssertUnstampNotice(unstamped.SeasonNotice);
        Assert.Null((await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == created.Id)).SeasonId);

        var stillNull = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/player-assessments/{created.Id}", Body(Off2)));
        Assert.Null(stillNull.SeasonNotice);
        Assert.Null((await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == created.Id)).SeasonId);
    }

    // ── Path 6: match performance — player context ───────────────────────────

    [Fact]
    public async Task Match_performance_update_restamps_via_roster()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        object Body(string date) => new
        { playerId = f.RosteredPlayerId, matchDate = date, opponent = "Restamp MP Opp", performanceRating = 7 };

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync("/api/match-performance", Body(InA1)));
        Assert.Equal(f.SeasonAId, (await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        var sameSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/match-performance/{created.Id}", Body(InA2)));
        Assert.Null(sameSeason.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        var otherSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/match-performance/{created.Id}", Body(InB)));
        Assert.Null(otherSeason.SeasonNotice);
        Assert.Equal(f.SeasonBId, (await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        var unstamped = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/match-performance/{created.Id}", Body(Off1)));
        AssertUnstampNotice(unstamped.SeasonNotice);
        Assert.Null((await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);

        var stillNull = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/match-performance/{created.Id}", Body(Off2)));
        Assert.Null(stillNull.SeasonNotice);
        Assert.Null((await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == created.Id)).SeasonId);
    }

    // ── Path 8: training session — team context on the session's own TeamId ──

    [Fact]
    public async Task Training_session_update_restamps_team_context()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        object Body(string date) => new
        { playerId = f.RosteredPlayerId, teamId = f.TeamId, date, durationMinutes = 90, attendanceStatus = "Present" };

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync("/api/training-sessions", Body(InA1)));
        Assert.Equal(f.SeasonAId, (await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var sameSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/training-sessions/{created.Id}", Body(InA2)));
        Assert.Null(sameSeason.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var otherSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/training-sessions/{created.Id}", Body(InB)));
        Assert.Null(otherSeason.SeasonNotice);
        Assert.Equal(f.SeasonBId, (await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var unstamped = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/training-sessions/{created.Id}", Body(Off1)));
        AssertUnstampNotice(unstamped.SeasonNotice);
        Assert.Null((await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var stillNull = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/training-sessions/{created.Id}", Body(Off2)));
        Assert.Null(stillNull.SeasonNotice);
        Assert.Null((await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);
    }

    // ── Path 9: scheduled session — client LOCAL date drives re-resolution ───

    [Fact]
    public async Task Scheduled_session_update_restamps_on_local_date()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        object Body(string startTime, string localDate) => new
        { title = "Restamp Session", sessionType = "Training", startTime, localDate, durationMinutes = 60 };

        var created = await ReadDtoAsync(await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/sessions",
            Body("2030-03-15T10:00:00Z", "2030-03-15")));
        Assert.Equal(f.SeasonAId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        // The S2.2 case ON UPDATE: the new StartTime's UTC instant is already July 1
        // (outside season A) but the user's local session date is June 30 — the supplied
        // local date must win and keep the session in season A.
        var evening = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/sessions/{created.Id}",
            Body("2030-07-01T01:00:00Z", "2030-06-30")));
        Assert.Null(evening.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var otherSeason = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/sessions/{created.Id}",
            Body("2031-03-01T10:00:00Z", "2031-03-01")));
        Assert.Null(otherSeason.SeasonNotice);
        Assert.Equal(f.SeasonBId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var unstamped = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/sessions/{created.Id}",
            Body("2029-05-05T10:00:00Z", "2029-05-05")));
        AssertUnstampNotice(unstamped.SeasonNotice);
        Assert.Null((await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);

        var stillNull = await ReadDtoAsync(await coach.PutAsJsonAsync($"/api/sessions/{created.Id}",
            Body("2029-06-06T10:00:00Z", "2029-06-06")));
        Assert.Null(stillNull.SeasonNotice);
        Assert.Null((await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == created.Id)).SeasonId);
    }

    // ── Solo (player-context branches of match + session updates over HTTP) ──

    [Fact]
    public async Task Solo_match_and_session_updates_stay_null_with_no_notice()
    {
        using var scope = _factory.Services.CreateScope();
        await ArrangeAsync(scope);
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register-solo", new
        {
            email = $"solo.restamp.{Guid.NewGuid():N}@restamp.test",
            password = "RestampTest123!",
            fullName = "Solo Restamp Tester",
            dateOfBirth = "2000-01-15T00:00:00Z",
            height = 180.0,
            weight = 75.0,
            sportId = 1,
            positionId = 1,
            skillLevel = "Intermediate",
            trainingFrequency = "FewTimesWeek",
        });
        register.EnsureSuccessStatusCode();

        var match = await ReadDtoAsync(await client.PostAsJsonAsync("/api/solo/matches", new
        { opponentName = "Solo Restamp Opp", matchDate = InA1, homeScore = 1, awayScore = 0, isHome = true }));
        // Solo athletes have no roster rows: null before, null after — and NO notice.
        var matchUpdated = await ReadDtoAsync(await client.PutAsJsonAsync($"/api/matches/{match.Id}", new
        { opponentName = "Solo Restamp Opp", matchDate = InB, homeScore = 1, awayScore = 0, isHome = true }));
        Assert.Null(matchUpdated.SeasonNotice);

        var session = await ReadDtoAsync(await client.PostAsJsonAsync("/api/solo/sessions", new
        { title = "Solo Restamp Session", sessionType = "Training", startTime = "2030-03-15T10:00:00Z", durationMinutes = 60 }));
        var sessionUpdated = await ReadDtoAsync(await client.PutAsJsonAsync($"/api/sessions/{session.Id}", new
        { title = "Solo Restamp Session", sessionType = "Training", startTime = "2031-03-01T10:00:00Z", localDate = "2031-03-01", durationMinutes = 60 }));
        Assert.Null(sessionUpdated.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var matchRow = await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Null(matchRow.SeasonId);
        Assert.Equal(D(2031, 3, 1), matchRow.MatchDate);
        Assert.Null((await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id)).SeasonId);
    }

    // ── Non-date edits never consult the resolver; a throwing resolver never
    //    loses the stamp or the save — asserted per wired path via direct
    //    service construction with fake stampers/resolvers. ──────────────────

    [Fact]
    public async Task Match_update_skips_resolver_on_non_date_edit_and_survives_resolver_failure()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var evidence = scope.ServiceProvider.GetRequiredService<IEvidenceScoringEngine>();
        var principal = CoachPrincipal(f);

        var seeded = new MatchResult
        { TeamId = f.TeamId, OpponentName = "Skip FC", MatchDate = D(2030, 3, 15), ScoreFormat = ScoreFormat.Goals, SeasonId = f.SeasonAId };
        db.MatchResults.Add(seeded);
        await db.SaveChangesAsync();

        // Same date, different opponent: the resolver must not be consulted at all.
        var recorder = new RecordingStamper();
        var recording = new MatchService(db, access, evidence, recorder, NullLogger<MatchService>.Instance);
        await recording.UpdateAsync(principal, seeded.Id, new CreateMatchResultDto
        { OpponentName = "Skip FC Renamed", MatchDate = D(2030, 3, 15), HomeScore = 0, AwayScore = 0, IsHome = true });
        Assert.Equal(0, recorder.TotalCalls);
        Assert.Equal(f.SeasonAId, (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == seeded.Id)).SeasonId);

        // Date change + exploding resolver: SeasonId unchanged, the save still lands.
        var throwing = new MatchService(db, access, evidence, ThrowingStamper(), NullLogger<MatchService>.Instance);
        await throwing.UpdateAsync(principal, seeded.Id, new CreateMatchResultDto
        { OpponentName = "Skip FC Renamed", MatchDate = D(2029, 5, 5), HomeScore = 0, AwayScore = 0, IsHome = true });
        var row = await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == seeded.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
        Assert.Equal(D(2029, 5, 5), row.MatchDate);
    }

    [Fact]
    public async Task Assessment_update_skips_resolver_on_non_date_edit_and_survives_resolver_failure()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var goals = scope.ServiceProvider.GetRequiredService<IPersonalGoalService>();
        var principal = CoachPrincipal(f);

        var seeded = new PlayerAssessment
        { PlayerId = f.RosteredPlayerId, AssessmentPeriodId = f.PeriodId, DateRecorded = D(2030, 3, 15), SeasonId = f.SeasonAId };
        db.PlayerAssessments.Add(seeded);
        await db.SaveChangesAsync();

        var recorder = new RecordingStamper();
        var recording = new AssessmentService(db, access, goals, recorder, NullLogger<AssessmentService>.Instance);
        await recording.UpdateAssessmentAsync(principal, seeded.Id, new CreatePlayerAssessmentDto
        { PlayerId = f.RosteredPlayerId, AssessmentPeriodId = f.PeriodId, DateRecorded = D(2030, 3, 15), Notes = "notes only" });
        Assert.Equal(0, recorder.TotalCalls);
        Assert.Equal(f.SeasonAId, (await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == seeded.Id)).SeasonId);

        var throwing = new AssessmentService(db, access, goals, ThrowingStamper(), NullLogger<AssessmentService>.Instance);
        await throwing.UpdateAssessmentAsync(principal, seeded.Id, new CreatePlayerAssessmentDto
        { PlayerId = f.RosteredPlayerId, AssessmentPeriodId = f.PeriodId, DateRecorded = D(2029, 5, 5) });
        var row = await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == seeded.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
        Assert.Equal(D(2029, 5, 5), row.DateRecorded);
    }

    [Fact]
    public async Task Match_performance_update_skips_resolver_on_non_date_edit_and_survives_resolver_failure()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var principal = CoachPrincipal(f);

        var seeded = new MatchPerformance
        { PlayerId = f.RosteredPlayerId, MatchDate = D(2030, 3, 15), Opponent = "Skip MP", PerformanceRating = 7, SeasonId = f.SeasonAId };
        db.MatchPerformances.Add(seeded);
        await db.SaveChangesAsync();

        var recorder = new RecordingStamper();
        var recording = new MatchPerformanceService(db, access, recorder);
        await recording.UpdateAsync(principal, seeded.Id, new CreateMatchPerformanceDto
        { PlayerId = f.RosteredPlayerId, MatchDate = D(2030, 3, 15), Opponent = "Skip MP Renamed", PerformanceRating = 8 });
        Assert.Equal(0, recorder.TotalCalls);
        Assert.Equal(f.SeasonAId, (await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == seeded.Id)).SeasonId);

        var throwing = new MatchPerformanceService(db, access, ThrowingStamper());
        await throwing.UpdateAsync(principal, seeded.Id, new CreateMatchPerformanceDto
        { PlayerId = f.RosteredPlayerId, MatchDate = D(2029, 5, 5), Opponent = "Skip MP Renamed", PerformanceRating = 8 });
        var row = await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == seeded.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
        Assert.Equal(D(2029, 5, 5), row.MatchDate);
    }

    [Fact]
    public async Task Training_session_update_skips_resolver_on_non_date_edit_and_survives_resolver_failure()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var principal = CoachPrincipal(f);

        var seeded = new TrainingSession
        { PlayerId = f.RosteredPlayerId, TeamId = f.TeamId, Date = D(2030, 3, 15), DurationMinutes = 90, AttendanceStatus = AttendanceStatus.Present, SeasonId = f.SeasonAId };
        db.TrainingSessions.Add(seeded);
        await db.SaveChangesAsync();

        var recorder = new RecordingStamper();
        var recording = new TrainingSessionService(db, access, recorder);
        await recording.UpdateAsync(principal, seeded.Id, new CreateTrainingSessionDto
        { PlayerId = f.RosteredPlayerId, TeamId = f.TeamId, Date = D(2030, 3, 15), DurationMinutes = 60, AttendanceStatus = AttendanceStatus.Late });
        Assert.Equal(0, recorder.TotalCalls);
        Assert.Equal(f.SeasonAId, (await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == seeded.Id)).SeasonId);

        var throwing = new TrainingSessionService(db, access, ThrowingStamper());
        await throwing.UpdateAsync(principal, seeded.Id, new CreateTrainingSessionDto
        { PlayerId = f.RosteredPlayerId, TeamId = f.TeamId, Date = D(2029, 5, 5), DurationMinutes = 60, AttendanceStatus = AttendanceStatus.Late });
        var row = await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == seeded.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
        Assert.Equal(D(2029, 5, 5), row.Date);
    }

    [Fact]
    public async Task Scheduled_session_update_skips_resolver_on_non_start_edit_and_survives_resolver_failure()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var principal = CoachPrincipal(f);

        var seeded = new ScheduledSession
        { TeamId = f.TeamId, Title = "Skip Session", SessionType = SessionType.Training, StartTime = new DateTime(2030, 3, 15, 10, 0, 0, DateTimeKind.Utc), DurationMinutes = 60, SeasonId = f.SeasonAId };
        db.ScheduledSessions.Add(seeded);
        await db.SaveChangesAsync();

        // Same StartTime (localDate present or not) -> the resolver is not consulted.
        var recorder = new RecordingStamper();
        var recording = new ScheduledSessionService(db, access, recorder);
        await recording.UpdateAsync(principal, seeded.Id, new CreateScheduledSessionDto
        { Title = "Skip Session Renamed", SessionType = SessionType.Training, StartTime = new DateTime(2030, 3, 15, 10, 0, 0, DateTimeKind.Utc), LocalDate = "2030-03-15", DurationMinutes = 45 });
        Assert.Equal(0, recorder.TotalCalls);
        Assert.Equal(f.SeasonAId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == seeded.Id)).SeasonId);

        var throwing = new ScheduledSessionService(db, access, ThrowingStamper());
        await throwing.UpdateAsync(principal, seeded.Id, new CreateScheduledSessionDto
        { Title = "Skip Session Renamed", SessionType = SessionType.Training, StartTime = new DateTime(2029, 5, 5, 10, 0, 0, DateTimeKind.Utc), LocalDate = "2029-05-05", DurationMinutes = 45 });
        var row = await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == seeded.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
        Assert.Equal(new DateTime(2029, 5, 5, 10, 0, 0, DateTimeKind.Utc), row.StartTime);
    }

    // ── Cascade: a team match's date edit restamps its lineup ────────────────

    [Fact]
    public async Task Match_date_edit_cascades_season_restamp_to_its_lineup()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var match = new MatchResult
        { TeamId = f.TeamId, OpponentName = "Cascade FC", MatchDate = D(2030, 3, 15), ScoreFormat = ScoreFormat.Goals };
        db.MatchResults.Add(match);
        await db.SaveChangesAsync();

        var lineups = scope.ServiceProvider.GetRequiredService<ILineupService>();
        var lineup = await lineups.UpsertAsync(CoachPrincipal(f), f.TeamId, new SaveLineupDto
        { MatchResultId = match.Id, Formation = "4-4-2" });
        Assert.Equal(f.SeasonAId, (await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == lineup.Id)).SeasonId);

        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Match moved to a different season -> the lineup's stamp follows it.
        var moved = await coach.PutAsJsonAsync($"/api/matches/{match.Id}", new
        { opponentName = "Cascade FC", matchDate = InB, homeScore = 0, awayScore = 0, isHome = true });
        moved.EnsureSuccessStatusCode();
        Assert.Equal(f.SeasonBId, (await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == lineup.Id)).SeasonId);
        Assert.Equal(f.SeasonBId, (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == match.Id)).SeasonId);

        // Match moved outside all seasons -> the lineup unstamps too.
        var outside = await coach.PutAsJsonAsync($"/api/matches/{match.Id}", new
        { opponentName = "Cascade FC", matchDate = Off1, homeScore = 0, awayScore = 0, isHome = true });
        outside.EnsureSuccessStatusCode();
        Assert.Null((await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == lineup.Id)).SeasonId);
    }

    [Fact]
    public async Task Published_lineup_cascade_keeps_version_and_writes_no_audit()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var match = new MatchResult
        { TeamId = f.TeamId, OpponentName = "Cascade Published FC", MatchDate = D(2030, 3, 15), ScoreFormat = ScoreFormat.Goals };
        db.MatchResults.Add(match);
        await db.SaveChangesAsync();

        var lineups = scope.ServiceProvider.GetRequiredService<ILineupService>();
        var principal = CoachPrincipal(f);
        var lineup = await lineups.UpsertAsync(principal, f.TeamId, new SaveLineupDto
        { MatchResultId = match.Id, Formation = "4-4-2" });
        await lineups.PublishAsync(principal, lineup.Id);

        var before = await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == lineup.Id);
        Assert.Equal(LineupStatus.Published, before.Status);
        var auditsBefore = await db.LineupChangeAudits.CountAsync(a => a.LineupId == lineup.Id);

        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var moved = await coach.PutAsJsonAsync($"/api/matches/{match.Id}", new
        { opponentName = "Cascade Published FC", matchDate = InB, homeScore = 0, awayScore = 0, isHome = true });
        moved.EnsureSuccessStatusCode();

        // The stamp moved; the tactical content did not: same Version, same Status,
        // not a single new audit row.
        var after = await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == lineup.Id);
        Assert.Equal(f.SeasonBId, after.SeasonId);
        Assert.Equal(before.Version, after.Version);
        Assert.Equal(LineupStatus.Published, after.Status);
        Assert.Equal(auditsBefore, await db.LineupChangeAudits.CountAsync(a => a.LineupId == lineup.Id));
    }

    [Fact]
    public async Task Solo_match_update_attempts_no_lineup_cascade()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var access = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
        var evidence = scope.ServiceProvider.GetRequiredService<IEvidenceScoringEngine>();

        var solo = new MatchResult
        { PlayerId = f.RosteredPlayerId, OpponentName = "Solo Cascade Opp", MatchDate = D(2030, 3, 15), ScoreFormat = ScoreFormat.Goals };
        db.MatchResults.Add(solo);
        await db.SaveChangesAsync();

        var recorder = new RecordingStamper();
        var service = new MatchService(db, access, evidence, recorder, NullLogger<MatchService>.Instance);
        await service.UpdateAsync(CoachPrincipal(f), solo.Id, new CreateMatchResultDto
        { OpponentName = "Solo Cascade Opp", MatchDate = D(2031, 3, 1), HomeScore = 0, AwayScore = 0, IsHome = true });

        // Exactly one player-context restamp; the team-context path (which is where a
        // lineup cascade would go) was never touched.
        Assert.Equal(1, recorder.RestampPlayerCalls);
        Assert.Equal(0, recorder.RestampTeamCalls);
        Assert.Equal(D(2031, 3, 1), (await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == solo.Id)).MatchDate);
    }
}
