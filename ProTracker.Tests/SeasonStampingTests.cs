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

// Phase 10 S3 ruling under test: a create NEVER fails because of season resolution.
// Resolved -> SeasonId set; NoCoveringSeason -> null, silent; Ambiguous -> null +
// non-blocking SeasonNotice in the response, record still persisted. Player-context
// paths resolve via SeasonRoster ONLY (never Player.TeamId — the same trap S2's
// test (g) protects).
public class SeasonStampingTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonStampingTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed class Fixture
    {
        public int TeamId;
        public int SeasonAId, SeasonOverlap1Id, SeasonOverlap2Id, SeasonNowId;
        public int RosteredPlayerId, TrapPlayerId, AmbPlayerId, NowPlayerId;
        public int PeriodId;
        public string CoachId = "";
    }

    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

    private async Task<Fixture> ArrangeAsync(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var f = new Fixture();
        var ownerId = (await db.Users.FirstAsync(u => u.Email == TestAuth.SoccerCoachEmail)).Id;
        f.CoachId = ownerId;

        var existing = await db.Teams.FirstOrDefaultAsync(t => t.Name == "STP United");
        if (existing == null)
        {
            var team = new Team { Name = "STP United", SportId = 1, CoachId = ownerId };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            // Coach access flows through CoachTeamScope, not Team.CoachId.
            db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = ownerId, TeamId = team.Id });

            Season Mk(string name, DateTime start, DateTime end, SeasonStatus status)
            {
                var s = new Season { OwnerId = ownerId, Name = name, StartDate = start, EndDate = end, Status = status };
                s.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
                db.Seasons.Add(s);
                return s;
            }

            var today = DateTime.UtcNow.Date;
            var sA = Mk("STP 2030", D(2030, 1, 1), D(2030, 6, 30), SeasonStatus.Active);
            var sOv1 = Mk("STP Overlap 1", D(2032, 1, 1), D(2032, 12, 31), SeasonStatus.Active);
            var sOv2 = Mk("STP Overlap 2", D(2032, 6, 1), D(2033, 5, 31), SeasonStatus.Draft);
            var sNow = Mk("STP Now", today.AddDays(-1), today.AddDays(1), SeasonStatus.Active);
            await db.SaveChangesAsync();

            Player MkPlayer(string name)
            {
                var p = new Player { FullName = name, Age = 20, SportId = 1, PositionId = 1, TeamId = team.Id };
                db.Players.Add(p);
                return p;
            }

            var pRostered = MkPlayer("STP Rostered");
            // The (g)-shaped trap: TeamId points at a team WITH a covering season, but
            // there is no roster row — player-context must still say null.
            var pTrap = MkPlayer("STP Trap");
            var pAmb = MkPlayer("STP Amb");
            var pNow = MkPlayer("STP Now");
            await db.SaveChangesAsync();

            db.SeasonRosters.AddRange(
                new SeasonRoster { PlayerId = pRostered.Id, SeasonId = sA.Id, TeamId = team.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 6, 30) },
                new SeasonRoster { PlayerId = pAmb.Id, SeasonId = sOv1.Id, TeamId = team.Id, JoinedAt = D(2032, 1, 1), LeftAt = D(2032, 12, 31) },
                new SeasonRoster { PlayerId = pAmb.Id, SeasonId = sOv2.Id, TeamId = team.Id, JoinedAt = D(2032, 6, 1), LeftAt = null },
                new SeasonRoster { PlayerId = pNow.Id, SeasonId = sNow.Id, TeamId = team.Id, JoinedAt = today.AddDays(-1), LeftAt = null });

            db.AssessmentPeriods.Add(new AssessmentPeriod
            {
                Name = "STP Period",
                TeamId = team.Id,
                StartDate = D(2030, 1, 1),
                EndDate = D(2033, 12, 31),
            });
            await db.SaveChangesAsync();
        }

        f.TeamId = (await db.Teams.SingleAsync(t => t.Name == "STP United")).Id;
        f.SeasonAId = (await db.Seasons.SingleAsync(s => s.Name == "STP 2030")).Id;
        f.SeasonOverlap1Id = (await db.Seasons.SingleAsync(s => s.Name == "STP Overlap 1")).Id;
        f.SeasonOverlap2Id = (await db.Seasons.SingleAsync(s => s.Name == "STP Overlap 2")).Id;
        f.SeasonNowId = (await db.Seasons.SingleAsync(s => s.Name == "STP Now")).Id;
        f.RosteredPlayerId = (await db.Players.SingleAsync(p => p.FullName == "STP Rostered")).Id;
        f.TrapPlayerId = (await db.Players.SingleAsync(p => p.FullName == "STP Trap")).Id;
        f.AmbPlayerId = (await db.Players.SingleAsync(p => p.FullName == "STP Amb")).Id;
        f.NowPlayerId = (await db.Players.SingleAsync(p => p.FullName == "STP Now")).Id;
        f.PeriodId = (await db.AssessmentPeriods.SingleAsync(p => p.Name == "STP Period")).Id;
        return f;
    }

    // Response DTOs carry string-serialized enums the test client can't bind back;
    // creates here only need the id and the notice, so deserialize just those.
    private sealed class CreatedWithNotice
    {
        public int Id { get; set; }
        public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    }

    private static void AssertAmbiguousNotice(SeasonResolutionNoticeDto? notice, Fixture f)
    {
        Assert.NotNull(notice);
        Assert.Equal("AmbiguousSeason", notice!.Code);
        Assert.Equal(
            new[] { f.SeasonOverlap1Id, f.SeasonOverlap2Id }.OrderBy(id => id).ToList(),
            notice.CandidateSeasonIds);
    }

    // ── Path 1: team match — full outcome matrix ─────────────────────────────

    [Fact]
    public async Task Team_match_resolved_gets_season_id()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/matches", new
        { opponentName = "Stamp FC Resolved", matchDate = "2030-03-15T00:00:00Z", homeScore = 2, awayScore = 1, isHome = true });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == dto.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
    }

    [Fact]
    public async Task Team_match_no_covering_season_saves_with_null_and_no_notice()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/matches", new
        { opponentName = "Stamp FC Offseason", matchDate = "2029-05-05T00:00:00Z", homeScore = 1, awayScore = 1, isHome = false });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == dto.Id);
        Assert.Null(row.SeasonId);
    }

    [Fact]
    public async Task Team_match_ambiguous_saves_with_null_and_notice()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/matches", new
        { opponentName = "Stamp FC Ambiguous", matchDate = "2032-08-01T00:00:00Z", homeScore = 0, awayScore = 3, isHome = true });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        AssertAmbiguousNotice(dto.SeasonNotice, f);

        // The record is definitely persisted — asserted from the DB, not the response.
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == dto.Id);
        Assert.Null(row.SeasonId);
        Assert.Equal("Stamp FC Ambiguous", row.OpponentName);
    }

    // ── Path 3: assessment — full player-context matrix ──────────────────────

    [Fact]
    public async Task Assessment_rostered_player_resolves_via_roster()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = f.RosteredPlayerId,
            assessmentPeriodId = f.PeriodId,
            dateRecorded = "2030-03-15T00:00:00Z",
            statScores = Array.Empty<object>(),
        });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerAssessmentDto>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == dto.Id);
        Assert.Equal(f.SeasonAId, row.SeasonId);
    }

    // The (g)-shaped regression: Player.TeamId points at a team whose season covers the
    // date, but the player has NO roster row — the stamp must be null, proving the
    // resolution went through SeasonRoster and not Player.TeamId.
    [Fact]
    public async Task Assessment_unrostered_player_is_null_even_when_current_team_has_covering_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Arm the trap: the player's CURRENT team resolves for this date.
        var trapPlayer = await db.Players.AsNoTracking().SingleAsync(p => p.Id == f.TrapPlayerId);
        Assert.Equal(f.TeamId, trapPlayer.TeamId);
        var resolver = scope.ServiceProvider.GetRequiredService<ISeasonResolver>();
        var teamResolution = await resolver.ResolveForTeamAsync(f.TeamId, new DateOnly(2030, 3, 15));
        Assert.Equal(f.SeasonAId, teamResolution.SeasonId);

        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var response = await coach.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = f.TrapPlayerId,
            assessmentPeriodId = f.PeriodId,
            dateRecorded = "2030-03-15T00:00:00Z",
            statScores = Array.Empty<object>(),
        });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerAssessmentDto>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var row = await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == dto.Id);
        Assert.Null(row.SeasonId);
    }

    [Fact]
    public async Task Assessment_ambiguous_roster_saves_with_notice_and_is_persisted()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = f.AmbPlayerId,
            assessmentPeriodId = f.PeriodId,
            dateRecorded = "2032-08-01T00:00:00Z",
            statScores = Array.Empty<object>(),
        });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerAssessmentDto>>())!.Data!;
        AssertAmbiguousNotice(dto.SeasonNotice, f);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var row = await db.PlayerAssessments.AsNoTracking().SingleAsync(a => a.Id == dto.Id);
        Assert.Null(row.SeasonId);
    }

    // ── Path 2 + 10: solo creates (player context; no roster rows possible) ──

    [Fact]
    public async Task Solo_match_and_session_save_with_null_season_and_no_notice()
    {
        using var scope = _factory.Services.CreateScope();
        await ArrangeAsync(scope);
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register-solo", new
        {
            email = $"solo.stamp.{Guid.NewGuid():N}@stamp.test",
            password = "StampTest123!",
            fullName = "Solo Stamp Tester",
            dateOfBirth = "2000-01-15T00:00:00Z",
            height = 180.0,
            weight = 75.0,
            sportId = 1,
            positionId = 1,
            skillLevel = "Intermediate",
            trainingFrequency = "FewTimesWeek",
        });
        register.EnsureSuccessStatusCode();

        var matchResponse = await client.PostAsJsonAsync("/api/solo/matches", new
        { opponentName = "Solo Stamp Opp", matchDate = "2030-03-15T00:00:00Z", homeScore = 1, awayScore = 0, isHome = true });
        matchResponse.EnsureSuccessStatusCode();
        var match = (await matchResponse.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(match.SeasonNotice);

        var sessionResponse = await client.PostAsJsonAsync("/api/solo/sessions", new
        { title = "Solo Stamp Session", sessionType = "Training", startTime = "2030-03-15T10:00:00Z", durationMinutes = 60 });
        sessionResponse.EnsureSuccessStatusCode();
        var session = (await sessionResponse.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(session.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Null((await db.MatchResults.AsNoTracking().SingleAsync(m => m.Id == match.Id)).SeasonId);
        Assert.Null((await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == session.Id)).SeasonId);
    }

    // ── Path 4: objective test ───────────────────────────────────────────────

    // Objective tests reject future dates, so this path is exercised against the
    // today-window season: rostered-today resolves, the unrostered trap stays null.
    [Fact]
    public async Task Objective_test_resolves_for_rostered_and_nulls_for_unrostered()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var metricId = (await db.SportMetricDefinitions.FirstAsync(d => d.SportId == 1)).Id;
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var today = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");

        var rostered = await coach.PostAsJsonAsync("/api/objective-tests", new
        { playerId = f.NowPlayerId, metricDefinitionId = metricId, value = 5.0, testedAt = today });
        rostered.EnsureSuccessStatusCode();
        var rosteredDto = (await rostered.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(rosteredDto.SeasonNotice);
        Assert.Equal(f.SeasonNowId, (await db.ObjectiveTestResults.AsNoTracking().SingleAsync(t => t.Id == rosteredDto.Id)).SeasonId);

        var trap = await coach.PostAsJsonAsync("/api/objective-tests", new
        { playerId = f.TrapPlayerId, metricDefinitionId = metricId, value = 5.0, testedAt = today });
        trap.EnsureSuccessStatusCode();
        var trapDto = (await trap.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(trapDto.SeasonNotice);
        Assert.Null((await db.ObjectiveTestResults.AsNoTracking().SingleAsync(t => t.Id == trapDto.Id)).SeasonId);
    }

    // ── Path 5: evidence scores (engine, UTC-today fallback by design) ───────

    [Fact]
    public async Task Evidence_score_recalc_stamps_current_season_for_rostered_player()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var metricId = (await db.SportMetricDefinitions.FirstAsync(d => d.SportId == 1)).Id;

        db.ObjectiveTestResults.Add(new ObjectiveTestResult
        {
            PlayerId = f.NowPlayerId,
            MetricDefinitionId = metricId,
            Value = 5,
            Unit = "",
            TestedAt = DateTime.UtcNow,
            TestedBy = TestedByType.Coach,
        });
        await db.SaveChangesAsync();

        var engine = scope.ServiceProvider.GetRequiredService<IEvidenceScoringEngine>();
        var score = await engine.CalculateScoreAsync(f.NowPlayerId, metricId);
        Assert.NotNull(score);
        Assert.Equal(f.SeasonNowId, score!.SeasonId);
        Assert.Equal(f.SeasonNowId,
            (await db.EvidenceBasedScores.AsNoTracking()
                .SingleAsync(s => s.PlayerId == f.NowPlayerId && s.MetricDefinitionId == metricId && s.AssessmentId == null)).SeasonId);
    }

    [Fact]
    public async Task Evidence_score_recalc_is_null_for_unrostered_player()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var metricId = (await db.SportMetricDefinitions.FirstAsync(d => d.SportId == 1)).Id;

        db.ObjectiveTestResults.Add(new ObjectiveTestResult
        {
            PlayerId = f.TrapPlayerId,
            MetricDefinitionId = metricId,
            Value = 5,
            Unit = "",
            TestedAt = DateTime.UtcNow,
            TestedBy = TestedByType.Coach,
        });
        await db.SaveChangesAsync();

        var engine = scope.ServiceProvider.GetRequiredService<IEvidenceScoringEngine>();
        var score = await engine.CalculateScoreAsync(f.TrapPlayerId, metricId);
        Assert.NotNull(score);
        Assert.Null(score!.SeasonId);
    }

    // ── Path 6: match performance ────────────────────────────────────────────

    [Fact]
    public async Task Match_performance_resolves_via_roster()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/match-performance", new
        { playerId = f.RosteredPlayerId, matchDate = "2030-03-15T00:00:00Z", opponent = "Stamp MP Opp", performanceRating = 7 });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(f.SeasonAId, (await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == dto.Id)).SeasonId);

        var trap = await coach.PostAsJsonAsync("/api/match-performance", new
        { playerId = f.TrapPlayerId, matchDate = "2030-03-15T00:00:00Z", opponent = "Stamp MP Trap", performanceRating = 6 });
        trap.EnsureSuccessStatusCode();
        var trapDto = (await trap.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null((await db.MatchPerformances.AsNoTracking().SingleAsync(m => m.Id == trapDto.Id)).SeasonId);
    }

    // ── Path 7: lineups — match lineups stamp, templates never do ────────────

    [Fact]
    public async Task Match_lineup_stamps_from_match_date_and_default_xi_stays_null()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var match = new MatchResult
        {
            TeamId = f.TeamId,
            OpponentName = "Stamp Lineup Opp",
            MatchDate = D(2030, 3, 15),
            ScoreFormat = ScoreFormat.Goals,
        };
        db.MatchResults.Add(match);
        await db.SaveChangesAsync();

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, f.CoachId),
            new Claim(ClaimTypes.Role, "Coach"),
        }, "Test"));
        var lineups = scope.ServiceProvider.GetRequiredService<ILineupService>();

        var matchLineup = await lineups.UpsertAsync(principal, f.TeamId, new SaveLineupDto
        { MatchResultId = match.Id, Formation = "4-4-2" });
        Assert.Null(matchLineup.SeasonNotice);
        Assert.Equal(f.SeasonAId, (await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == matchLineup.Id)).SeasonId);

        // Default XI is a reusable template, not a dated event — never stamped.
        var defaultXi = await lineups.UpsertAsync(principal, f.TeamId, new SaveLineupDto
        { Formation = "4-3-3" });
        Assert.Null(defaultXi.SeasonNotice);
        Assert.Null((await db.Lineups.AsNoTracking().SingleAsync(l => l.Id == defaultXi.Id)).SeasonId);
    }

    // ── Path 8: training session (team context — record pins its own TeamId) ─

    [Fact]
    public async Task Training_session_resolves_team_context_on_its_own_date()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/training-sessions", new
        { playerId = f.TrapPlayerId, teamId = f.TeamId, date = "2030-03-15T00:00:00Z", durationMinutes = 90, attendanceStatus = "Present" });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(f.SeasonAId, (await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == dto.Id)).SeasonId);

        var offseason = await coach.PostAsJsonAsync("/api/training-sessions", new
        { playerId = f.TrapPlayerId, teamId = f.TeamId, date = "2029-05-05T00:00:00Z", durationMinutes = 60, attendanceStatus = "Present" });
        offseason.EnsureSuccessStatusCode();
        var offDto = (await offseason.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null((await db.TrainingSessions.AsNoTracking().SingleAsync(s => s.Id == offDto.Id)).SeasonId);
    }

    // ── Path 9: team scheduled session — LOCAL date drives resolution ────────

    // The evening-user case for sessions: StartTime's UTC instant is already July 1
    // (outside the season), but the user's local session date is June 30 — the
    // supplied local date must win and resolve into the season.
    [Fact]
    public async Task Scheduled_session_local_date_wins_over_utc_date_part()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/sessions", new
        {
            title = "Stamp Evening Session",
            sessionType = "Training",
            startTime = "2030-07-01T01:00:00Z", // 9pm June 30 in Toronto
            localDate = "2030-06-30",
            durationMinutes = 60,
        });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(f.SeasonAId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == dto.Id)).SeasonId);
    }

    [Fact]
    public async Task Scheduled_session_without_local_date_falls_back_to_utc_date_part()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/sessions", new
        { title = "Stamp Fallback Session", sessionType = "Training", startTime = "2030-03-15T10:00:00Z", durationMinutes = 60 });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(f.SeasonAId, (await db.ScheduledSessions.AsNoTracking().SingleAsync(s => s.Id == dto.Id)).SeasonId);
    }

    [Fact]
    public async Task Scheduled_session_malformed_or_out_of_range_local_date_is_400()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var malformed = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/sessions", new
        { title = "Bad", sessionType = "Training", startTime = "2030-03-15T10:00:00Z", localDate = "not-a-date", durationMinutes = 60 });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, malformed.StatusCode);

        var outOfRange = await coach.PostAsJsonAsync($"/api/teams/{f.TeamId}/sessions", new
        { title = "Bad", sessionType = "Training", startTime = "2030-03-15T10:00:00Z", localDate = "2030-03-18", durationMinutes = 60 });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, outOfRange.StatusCode);
    }

    // ── Path 11: manual improvement plan (today-anchored local date) ─────────

    [Fact]
    public async Task Improvement_plan_resolves_current_season_for_rostered_player()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/improvement-plans", new
        { playerId = f.NowPlayerId, weeklyGoals = "Stamp plan goals" });
        response.EnsureSuccessStatusCode();
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null(dto.SeasonNotice);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(f.SeasonNowId, (await db.ImprovementPlans.AsNoTracking().SingleAsync(p => p.Id == dto.Id)).SeasonId);

        var trap = await coach.PostAsJsonAsync("/api/improvement-plans", new
        { playerId = f.TrapPlayerId, weeklyGoals = "Stamp trap goals" });
        trap.EnsureSuccessStatusCode();
        var trapDto = (await trap.Content.ReadFromJsonAsync<TestApiResponse<CreatedWithNotice>>())!.Data!;
        Assert.Null((await db.ImprovementPlans.AsNoTracking().SingleAsync(p => p.Id == trapDto.Id)).SeasonId);
    }

    [Fact]
    public async Task Improvement_plan_malformed_local_date_is_400()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await coach.PostAsJsonAsync("/api/improvement-plans", new
        { playerId = f.NowPlayerId, weeklyGoals = "Bad date", localDate = "31/12/2030" });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── The create is never contingent on the resolver ───────────────────────

    private sealed class ThrowingResolver : ISeasonResolver
    {
        public Task<SeasonResolution> ResolveForTeamAsync(int teamId, DateOnly date) =>
            throw new InvalidOperationException("resolver exploded");
        public Task<SeasonResolution> ResolveForPlayerAsync(int playerId, DateOnly date) =>
            throw new InvalidOperationException("resolver exploded");
        public Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForTeamBatchAsync(int teamId, IReadOnlyCollection<DateOnly> dates) =>
            throw new InvalidOperationException("resolver exploded");
        public Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForPlayerBatchAsync(int playerId, IReadOnlyCollection<DateOnly> dates) =>
            throw new InvalidOperationException("resolver exploded");
    }

    [Fact]
    public async Task Stamper_swallows_resolver_failures_into_a_null_stamp()
    {
        var stamper = new SeasonStamper(new ThrowingResolver(), NullLogger<SeasonStamper>.Instance);

        var teamStamp = await stamper.ForTeamAsync(1, new DateOnly(2030, 3, 15));
        Assert.Null(teamStamp.SeasonId);
        Assert.Null(teamStamp.Notice);

        var playerStamp = await stamper.ForPlayerAsync(1, new DateOnly(2030, 3, 15));
        Assert.Null(playerStamp.SeasonId);
        Assert.Null(playerStamp.Notice);
    }
}
