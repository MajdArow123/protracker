using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S7: backfill tooling. Rulings under test:
// - D1: resolution goes through SeasonResolver semantics — gap and ambiguous dates
//   stay NULL (incl. the S6 clamp: an open-ended stint never resolves past EndDate).
// - D2: NULL-only + idempotent — a pre-stamped row is never overwritten, whatever its
//   value; a second execute stamps zero.
// - D6: preview writes NOTHING (row-for-row DB equality); execute writes ONE audit row
//   whose counts/ids reflect exactly what was stamped.
// - D5: athletes 403 at the role gate; a coach owning no seasons (the assistant-coach
//   shape — assistants never own seasons) gets the uniform 404.
// - Scoping: one owner's execute can never stamp another owner's records.
// - Batch resolver variants are semantically identical to the single methods.
public class SeasonBackfillTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonBackfillTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static DateTime U(int y, int m, int d, int h = 0) => new(y, m, d, h, 0, 0, DateTimeKind.Utc);

    private sealed class Graph
    {
        public HttpClient Client = null!;
        public string OwnerId = "";
        public int TeamId, SeasonMainId, SeasonOtherId, SeasonOv1Id, SeasonOv2Id;
        public int PlayerAId, PlayerBId;
        public int AssessInWindowId, AssessGapId, AssessAmbiguousId, AssessPreStampedId;
        public int TestInWindowId, PerfPastEndId, ImprovementId;
        public int TeamMatchInId, TeamMatchGapId, MatchLineupId, TemplateLineupId;
        public int TrainingSessionId, ScheduledSessionId, LegacyPlanMappedId, LegacyPlanUnmappedId;
    }

    // A fresh, fully-owned account graph per call: owner scoping isolates every test
    // from the seed data and from other tests sharing this class database.
    private async Task<Graph> BuildGraphAsync(string tag)
    {
        var g = new Graph { Client = _factory.CreateClient() };
        var email = $"bf.{tag}.{Guid.NewGuid():N}@backfill.test";
        var register = await g.Client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = $"Backfill Coach {tag}",
            email,
            password = "Backfill123!",
            role = "Coach",
        });
        register.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        g.OwnerId = (await db.Users.SingleAsync(u => u.Email == email)).Id;

        var team = new Team { Name = $"BF Team {tag}", SportId = 1, CoachId = g.OwnerId };
        db.Teams.Add(team);
        await db.SaveChangesAsync();
        g.TeamId = team.Id;

        Season Mk(string name, DateTime start, DateTime end)
        {
            var s = new Season
            {
                OwnerId = g.OwnerId,
                Name = $"{name} {tag}",
                StartDate = start,
                EndDate = end,
                Status = SeasonStatus.Active,
            };
            s.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
            db.Seasons.Add(s);
            return s;
        }

        var main = Mk("BF Main", U(2050, 1, 1), U(2050, 6, 30));
        var other = Mk("BF Other", U(2051, 1, 1), U(2051, 12, 31));
        var ov1 = Mk("BF Ov1", U(2052, 1, 1), U(2052, 12, 31));
        var ov2 = Mk("BF Ov2", U(2052, 6, 1), U(2053, 5, 31));
        await db.SaveChangesAsync();
        (g.SeasonMainId, g.SeasonOtherId, g.SeasonOv1Id, g.SeasonOv2Id) = (main.Id, other.Id, ov1.Id, ov2.Id);

        // Player A: open-ended stint in Main (the S6 clamp case). UserId links the
        // mapped legacy plan. Player B: rostered into BOTH overlapping seasons.
        var playerA = new Player { FullName = $"BF Alpha {tag}", Age = 20, SportId = 1, PositionId = 1, TeamId = team.Id, UserId = g.OwnerId };
        var playerB = new Player { FullName = $"BF Beta {tag}", Age = 21, SportId = 1, PositionId = 1, TeamId = team.Id };
        db.Players.AddRange(playerA, playerB);
        await db.SaveChangesAsync();
        (g.PlayerAId, g.PlayerBId) = (playerA.Id, playerB.Id);

        db.SeasonRosters.AddRange(
            new SeasonRoster { PlayerId = playerA.Id, SeasonId = main.Id, TeamId = team.Id, JoinedAt = U(2050, 1, 10), LeftAt = null },
            new SeasonRoster { PlayerId = playerB.Id, SeasonId = ov1.Id, TeamId = team.Id, JoinedAt = U(2052, 1, 1), LeftAt = null },
            new SeasonRoster { PlayerId = playerB.Id, SeasonId = ov2.Id, TeamId = team.Id, JoinedAt = U(2052, 6, 1), LeftAt = null });

        var period = new AssessmentPeriod { Name = $"BF Period {tag}", TeamId = team.Id, StartDate = U(2049, 1, 1), EndDate = U(2059, 1, 1) };
        db.AssessmentPeriods.Add(period);
        await db.SaveChangesAsync();

        PlayerAssessment Assess(int playerId, DateTime date, int? seasonId = null) =>
            new() { PlayerId = playerId, AssessmentPeriodId = period.Id, DateRecorded = date, SeasonId = seasonId };

        var aIn = Assess(playerA.Id, U(2050, 3, 15));
        var aGap = Assess(playerA.Id, U(2049, 12, 1));
        var aAmb = Assess(playerB.Id, U(2052, 7, 1));
        // Pre-stamped (D2): resolvable date, but SeasonId already set to Other — a
        // backfill that "corrects" it would be an overwrite, which is forbidden.
        var aPre = Assess(playerA.Id, U(2050, 4, 1), other.Id);
        db.PlayerAssessments.AddRange(aIn, aGap, aAmb, aPre);

        var tIn = new ObjectiveTestResult { PlayerId = playerA.Id, MetricDefinitionId = 1, Value = 4.2m, TestedAt = U(2050, 2, 1) };
        db.ObjectiveTestResults.Add(tIn);

        // Past the season's EndDate while the stint is still open — the clamp says gap.
        var perf = new MatchPerformance { PlayerId = playerA.Id, MatchDate = U(2050, 9, 1), Opponent = "BF Clamp FC", PerformanceRating = 7 };
        db.MatchPerformances.Add(perf);

        var imp = new ImprovementPlan { PlayerId = playerA.Id, CreatedDate = U(2050, 3, 1) };
        db.ImprovementPlans.Add(imp);

        var mIn = new MatchResult { TeamId = team.Id, OpponentName = "BF In FC", MatchDate = U(2050, 3, 1), HomeScore = 1, AwayScore = 0, IsHome = true };
        var mGap = new MatchResult { TeamId = team.Id, OpponentName = "BF Gap FC", MatchDate = U(2049, 6, 1), HomeScore = 0, AwayScore = 0, IsHome = true };
        db.MatchResults.AddRange(mIn, mGap);

        var ts = new TrainingSession { PlayerId = playerA.Id, TeamId = team.Id, Date = U(2050, 2, 10), DurationMinutes = 60, AttendanceStatus = AttendanceStatus.Present };
        db.TrainingSessions.Add(ts);

        var ss = new ScheduledSession { TeamId = team.Id, Title = $"BF Session {tag}", SessionType = SessionType.Training, StartTime = U(2050, 2, 15, 18), DurationMinutes = 90 };
        db.ScheduledSessions.Add(ss);

        var tpMapped = new TrainingPlan { Title = $"BF Legacy Mapped {tag}", CoachId = g.OwnerId, AthleteId = g.OwnerId, StartDate = U(2050, 2, 20), EndDate = U(2050, 2, 27) };
        var tpUnmapped = new TrainingPlan { Title = $"BF Legacy Unmapped {tag}", CoachId = g.OwnerId, AthleteId = $"ghost-{tag}", StartDate = U(2050, 2, 20), EndDate = U(2050, 2, 27) };
        db.TrainingPlans.AddRange(tpMapped, tpUnmapped);
        await db.SaveChangesAsync();

        // Match lineup (candidate, resolves via its match's date) + template lineup
        // (Default XI — deliberately unstamped, must never even be a candidate).
        var matchLineup = new Lineup { TeamId = team.Id, MatchResultId = mIn.Id, Formation = "4-4-2" };
        var templateLineup = new Lineup { TeamId = team.Id, MatchResultId = null, Formation = "4-4-2" };
        db.Lineups.AddRange(matchLineup, templateLineup);
        await db.SaveChangesAsync();

        (g.AssessInWindowId, g.AssessGapId, g.AssessAmbiguousId, g.AssessPreStampedId) = (aIn.Id, aGap.Id, aAmb.Id, aPre.Id);
        g.TestInWindowId = tIn.Id;
        g.PerfPastEndId = perf.Id;
        g.ImprovementId = imp.Id;
        (g.TeamMatchInId, g.TeamMatchGapId) = (mIn.Id, mGap.Id);
        (g.MatchLineupId, g.TemplateLineupId) = (matchLineup.Id, templateLineup.Id);
        g.TrainingSessionId = ts.Id;
        g.ScheduledSessionId = ss.Id;
        (g.LegacyPlanMappedId, g.LegacyPlanUnmappedId) = (tpMapped.TrainingPlanId, tpUnmapped.TrainingPlanId);
        return g;
    }

    private static SeasonBackfillEntityDto Entity(SeasonBackfillPreviewDto dto, string type) =>
        dto.Entities.Single(e => e.EntityType == type);

    private async Task<SeasonBackfillPreviewDto> PreviewAsync(HttpClient client)
    {
        var response = await client.PostAsync("/api/seasons/backfill/preview", null);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<SeasonBackfillPreviewDto>>())!.Data!;
    }

    private async Task<SeasonBackfillResultDto> ExecuteAsync(HttpClient client)
    {
        var response = await client.PostAsync("/api/seasons/backfill/execute", null);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<SeasonBackfillResultDto>>())!.Data!;
    }

    private async Task<List<(string Entity, int Id, int? SeasonId)>> SnapshotAsync(Graph g)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rows = new List<(string, int, int?)>();
        rows.AddRange((await db.PlayerAssessments.Where(a => a.PlayerId == g.PlayerAId || a.PlayerId == g.PlayerBId)
            .Select(a => new { a.Id, a.SeasonId }).ToListAsync()).Select(x => ("assess", x.Id, x.SeasonId)));
        rows.AddRange((await db.MatchResults.Where(m => m.TeamId == g.TeamId)
            .Select(m => new { m.Id, m.SeasonId }).ToListAsync()).Select(x => ("match", x.Id, x.SeasonId)));
        rows.AddRange((await db.ObjectiveTestResults.Where(t => t.PlayerId == g.PlayerAId)
            .Select(t => new { t.Id, t.SeasonId }).ToListAsync()).Select(x => ("test", x.Id, x.SeasonId)));
        rows.AddRange((await db.MatchPerformances.Where(p => p.PlayerId == g.PlayerAId)
            .Select(p => new { p.Id, p.SeasonId }).ToListAsync()).Select(x => ("perf", x.Id, x.SeasonId)));
        rows.AddRange((await db.Lineups.Where(l => l.TeamId == g.TeamId)
            .Select(l => new { l.Id, l.SeasonId }).ToListAsync()).Select(x => ("lineup", x.Id, x.SeasonId)));
        rows.AddRange((await db.TrainingSessions.Where(t => t.TeamId == g.TeamId)
            .Select(t => new { t.Id, t.SeasonId }).ToListAsync()).Select(x => ("tsession", x.Id, x.SeasonId)));
        rows.AddRange((await db.ScheduledSessions.Where(s => s.TeamId == g.TeamId)
            .Select(s => new { s.Id, s.SeasonId }).ToListAsync()).Select(x => ("ssession", x.Id, x.SeasonId)));
        rows.AddRange((await db.ImprovementPlans.Where(p => p.PlayerId == g.PlayerAId)
            .Select(p => new { p.Id, p.SeasonId }).ToListAsync()).Select(x => ("improve", x.Id, x.SeasonId)));
        rows.AddRange((await db.TrainingPlans.Where(t => t.CoachId == g.OwnerId)
            .Select(t => new { Id = t.TrainingPlanId, t.SeasonId }).ToListAsync()).Select(x => ("tplan", x.Id, x.SeasonId)));
        return rows.OrderBy(r => r.Item1).ThenBy(r => r.Item2).ToList();
    }

    [Fact]
    public async Task Preview_counts_gap_and_ambiguous_honestly_and_writes_nothing()
    {
        var g = await BuildGraphAsync("prev");
        var before = await SnapshotAsync(g);

        var dto = await PreviewAsync(g.Client);

        var assess = Entity(dto, "playerAssessments");
        Assert.Equal(3, assess.TotalCandidates); // pre-stamped row is NOT a candidate
        Assert.Equal(1, assess.Stamped);
        Assert.Equal(1, assess.Gap);
        Assert.Equal(1, assess.Ambiguous);
        Assert.Equal(g.SeasonMainId, Assert.Single(assess.BySeason).SeasonId);
        Assert.Contains("BF Main", Assert.Single(assess.BySeason).SeasonName);

        var matches = Entity(dto, "matchResults");
        Assert.Equal(2, matches.TotalCandidates);
        Assert.Equal(1, matches.Stamped);
        Assert.Equal(1, matches.Gap);

        // The S6 clamp through the backfill path: open-ended stint, date past EndDate.
        var perfs = Entity(dto, "matchPerformances");
        Assert.Equal(1, perfs.TotalCandidates);
        Assert.Equal(0, perfs.Stamped);
        Assert.Equal(1, perfs.Gap);

        // Template lineups are not candidates at all — only the match lineup counts.
        var lineups = Entity(dto, "lineups");
        Assert.Equal(1, lineups.TotalCandidates);
        Assert.Equal(1, lineups.Stamped);

        Assert.Equal(1, Entity(dto, "objectiveTests").Stamped);
        Assert.Equal(1, Entity(dto, "improvementPlans").Stamped);
        Assert.Equal(1, Entity(dto, "trainingSessions").Stamped);
        Assert.Equal(1, Entity(dto, "scheduledSessions").Stamped);

        var plans = Entity(dto, "trainingPlans");
        Assert.Equal(2, plans.TotalCandidates); // mapped stamps, unmappable is a gap
        Assert.Equal(1, plans.Stamped);
        Assert.Equal(1, plans.Gap);

        Assert.Equal(13, dto.TotalCandidates);
        Assert.Equal(8, dto.TotalStamped);
        Assert.Equal(4, dto.TotalGap);
        Assert.Equal(1, dto.TotalAmbiguous);

        // D6: preview is a genuine dry run — row-for-row equality, no audit row.
        await PreviewAsync(g.Client);
        Assert.Equal(before, await SnapshotAsync(g));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(0, await db.SeasonBackfillRuns.CountAsync(r => r.OwnerId == g.OwnerId));
    }

    [Fact]
    public async Task Execute_stamps_resolvable_null_rows_only_writes_audit_and_reruns_as_noop()
    {
        var g = await BuildGraphAsync("exec");
        var result = await ExecuteAsync(g.Client);
        Assert.Equal(8, result.TotalStamped);
        Assert.Equal(4, result.TotalGap);
        Assert.Equal(1, result.TotalAmbiguous);
        Assert.True(result.RunId > 0);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // Resolvable rows carry Main now.
            Assert.Equal(g.SeasonMainId, (await db.PlayerAssessments.FindAsync(g.AssessInWindowId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.ObjectiveTestResults.FindAsync(g.TestInWindowId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.MatchResults.FindAsync(g.TeamMatchInId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.Lineups.FindAsync(g.MatchLineupId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.TrainingSessions.FindAsync(g.TrainingSessionId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.ScheduledSessions.FindAsync(g.ScheduledSessionId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.ImprovementPlans.FindAsync(g.ImprovementId))!.SeasonId);
            Assert.Equal(g.SeasonMainId, (await db.TrainingPlans.FindAsync(g.LegacyPlanMappedId))!.SeasonId);
            // Gap, ambiguous, template, unmappable: still NULL — never a guess.
            Assert.Null((await db.PlayerAssessments.FindAsync(g.AssessGapId))!.SeasonId);
            Assert.Null((await db.PlayerAssessments.FindAsync(g.AssessAmbiguousId))!.SeasonId);
            Assert.Null((await db.MatchResults.FindAsync(g.TeamMatchGapId))!.SeasonId);
            Assert.Null((await db.MatchPerformances.FindAsync(g.PerfPastEndId))!.SeasonId);
            Assert.Null((await db.Lineups.FindAsync(g.TemplateLineupId))!.SeasonId);
            Assert.Null((await db.TrainingPlans.FindAsync(g.LegacyPlanUnmappedId))!.SeasonId);
            // D2: the pre-stamped row keeps its original value, whatever it was.
            Assert.Equal(g.SeasonOtherId, (await db.PlayerAssessments.FindAsync(g.AssessPreStampedId))!.SeasonId);

            // Audit row: owner, counts, and the stamped ids grouped by entity.
            var run = await db.SeasonBackfillRuns.SingleAsync(r => r.OwnerId == g.OwnerId);
            Assert.Equal(result.RunId, run.Id);
            var ids = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<int>>>(run.StampedIdsJson)!;
            Assert.Equal(new[] { g.AssessInWindowId }, ids["playerAssessments"]);
            Assert.Equal(new[] { g.TeamMatchInId }, ids["matchResults"]);
            Assert.Equal(new[] { g.MatchLineupId }, ids["lineups"]);
            Assert.Empty(ids["matchPerformances"]);
            var counts = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, int>>>(run.CountsJson)!;
            Assert.Equal(1, counts["playerAssessments"]["stamped"]);
            Assert.Equal(1, counts["playerAssessments"]["gap"]);
            Assert.Equal(1, counts["playerAssessments"]["ambiguous"]);
        }

        // D2: the second run finds no NULL candidates left to stamp — a no-op that
        // still audits itself (it did run), with zero stamped.
        var after = await SnapshotAsync(g);
        var rerun = await ExecuteAsync(g.Client);
        Assert.Equal(0, rerun.TotalStamped);
        Assert.Equal(after, await SnapshotAsync(g));
    }

    [Fact]
    public async Task Athletes_403_and_a_coach_owning_no_seasons_404s()
    {
        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await athlete.PostAsync("/api/seasons/backfill/preview", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await athlete.PostAsync("/api/seasons/backfill/execute", null)).StatusCode);

        // The assistant-coach shape: Coach role, works on someone ELSE's team, owns no
        // seasons of their own — 404 on both verbs (nothing to backfill into, and the
        // head coach's data is unreachable by construction).
        var g = await BuildGraphAsync("auth");
        var assistantClient = _factory.CreateClient();
        var email = $"bf.assistant.{Guid.NewGuid():N}@backfill.test";
        (await assistantClient.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Backfill Assistant",
            email,
            password = "Backfill123!",
            role = "Coach",
        })).EnsureSuccessStatusCode();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var assistantId = (await db.Users.SingleAsync(u => u.Email == email)).Id;
            db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = assistantId, TeamId = g.TeamId });
            db.TeamCoachRoles.Add(new TeamCoachRole
            {
                TeamId = g.TeamId,
                UserId = assistantId,
                InvitedByUserId = g.OwnerId,
                PermissionsJson = CoachPermissions.All().ToJson(),
                AcceptedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.NotFound, (await assistantClient.PostAsync("/api/seasons/backfill/preview", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await assistantClient.PostAsync("/api/seasons/backfill/execute", null)).StatusCode);

        // The owner's graph is untouched by the failed attempts.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Null((await db.PlayerAssessments.FindAsync(g.AssessInWindowId))!.SeasonId);
        }
    }

    [Fact]
    public async Task One_owners_execute_never_touches_another_owners_records()
    {
        var a = await BuildGraphAsync("ownA");
        var b = await BuildGraphAsync("ownB");

        await ExecuteAsync(a.Client);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(a.SeasonMainId, (await db.PlayerAssessments.FindAsync(a.AssessInWindowId))!.SeasonId);
            Assert.Null((await db.PlayerAssessments.FindAsync(b.AssessInWindowId))!.SeasonId);
            Assert.Null((await db.MatchResults.FindAsync(b.TeamMatchInId))!.SeasonId);
        }

        var bResult = await ExecuteAsync(b.Client);
        Assert.Equal(8, bResult.TotalStamped);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(b.SeasonMainId, (await db.PlayerAssessments.FindAsync(b.AssessInWindowId))!.SeasonId);
        }
    }

    // D1's foundation: the batch variants must be indistinguishable from the single
    // methods across the boundary matrix (clamp, gaps, ambiguity, archived filtering,
    // guards). Any divergence here is a forked-resolution bug.
    [Fact]
    public async Task Batch_resolvers_match_single_resolver_semantics_date_by_date()
    {
        var g = await BuildGraphAsync("batch");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var resolver = new SeasonResolver(db,
            scope.ServiceProvider.GetRequiredService<ILogger<SeasonResolver>>());

        var dates = new[]
        {
            new DateOnly(2050, 1, 1),   // season start, before A's stint
            new DateOnly(2050, 1, 10),  // A's join day (counts wholly)
            new DateOnly(2050, 3, 15),  // mid-window
            new DateOnly(2050, 6, 30),  // final season day (inclusive)
            new DateOnly(2050, 7, 1),   // day after EndDate — the clamp
            new DateOnly(2049, 12, 31), // before any season
            new DateOnly(2052, 7, 1),   // ambiguous overlap window
            new DateOnly(2052, 3, 1),   // only Ov1 covers (Ov2 starts in June)
        };

        foreach (var contexts in new[] { ("team", g.TeamId), ("player", g.PlayerAId), ("player", g.PlayerBId) })
        {
            var (kind, id) = contexts;
            var batch = kind == "team"
                ? await resolver.ResolveForTeamBatchAsync(id, dates)
                : await resolver.ResolveForPlayerBatchAsync(id, dates);
            foreach (var date in dates)
            {
                var single = kind == "team"
                    ? await resolver.ResolveForTeamAsync(id, date)
                    : await resolver.ResolveForPlayerAsync(id, date);
                Assert.Equal(single.Outcome, batch[date].Outcome);
                Assert.Equal(single.SeasonId, batch[date].SeasonId);
                Assert.Equal(single.CandidateSeasonIds, batch[date].CandidateSeasonIds);
            }
        }

        // Guards behave the same too: a nonexistent id resolves nothing, for every date.
        var ghostBatch = await resolver.ResolveForPlayerBatchAsync(999_999, dates);
        foreach (var date in dates)
            Assert.Equal(SeasonResolutionOutcome.NoCoveringSeason, ghostBatch[date].Outcome);
    }
}

// Phase 10 S7: the SeasonBackfillRuns audit table — purely additive, PK + owner index
// only (the D6/S1b "nothing exotic" judgment call), clean Down on both providers
// (Postgres proven by the local `dotnet ef database update`; SQLite pinned here).
public class SeasonBackfillRunsMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonBackfillRunsMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SeasonBackfillRuns_table_applies_and_rolls_back_cleanly_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await TableExistsAsync(db, "SeasonBackfillRuns"));
        Assert.True(await IndexExistsAsync(db, "SeasonBackfillRuns", "IX_SeasonBackfillRuns_OwnerId"));

        // Down to the previous migration: the table goes away, nothing else moves.
        var previous = (await db.Database.GetAppliedMigrationsAsync())
            .Where(m => !m.EndsWith("_SeasonBackfillRuns"))
            .OrderBy(m => m)
            .Last();
        await migrator.MigrateAsync(previous);
        Assert.False(await TableExistsAsync(db, "SeasonBackfillRuns"));
        Assert.True(await TableExistsAsync(db, "SeasonRosters"));

        await migrator.MigrateAsync();
        Assert.True(await TableExistsAsync(db, "SeasonBackfillRuns"));
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string table)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{table}'");
        return Convert.ToInt64(result) > 0;
    }

    private static async Task<bool> IndexExistsAsync(ApplicationDbContext db, string table, string index)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='{table}' AND name='{index}'");
        return Convert.ToInt64(result) > 0;
    }

    private static async Task<object?> ScalarAsync(ApplicationDbContext db, string sql)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return await cmd.ExecuteScalarAsync();
    }
}
