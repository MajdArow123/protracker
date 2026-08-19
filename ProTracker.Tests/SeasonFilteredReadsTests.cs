using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S4 rulings under test: ?seasonId= is OPT-IN — no parameter means exactly
// today's behaviour (null-stamped rows included). A filter EXCLUDES null-stamped rows
// (no "unscoped" bucket). A season id that doesn't exist, or that the caller can't
// access, is 404 on every filtered endpoint — never an empty list (an empty list would
// be indistinguishable from "no data this season" and hide authorization failures).
// Archived seasons are readable when explicitly requested by id. The season-filtered
// team report is historical since §5h (stint roster + arm-2 edge; it formerly
// filtered assessments over TODAY's roster and flagged RosterIsCurrentNotHistorical).
public class SeasonFilteredReadsTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonFilteredReadsTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed class Fixture
    {
        public int TeamId;
        public int SeasonAId, SeasonBId, ForeignSeasonId;
        public int PlayerId;
        public int MatchAId, MatchBId, MatchNullId;
        public int AssessmentAId, AssessmentNullId;
    }

    private const int MissingSeasonId = 987654;

    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

    private async Task<Fixture> ArrangeAsync(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var f = new Fixture();
        var ownerId = (await db.Users.FirstAsync(u => u.Email == TestAuth.SoccerCoachEmail)).Id;
        var foreignOwnerId = (await db.Users.FirstAsync(u => u.Email == TestAuth.BasketballCoachEmail)).Id;

        var existing = await db.Teams.FirstOrDefaultAsync(t => t.Name == "SFR United");
        if (existing == null)
        {
            var team = new Team { Name = "SFR United", SportId = 1, CoachId = ownerId };
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = ownerId, TeamId = team.Id });

            var sA = new Season { OwnerId = ownerId, Name = "SFR 2030", StartDate = D(2030, 1, 1), EndDate = D(2030, 6, 30), Status = SeasonStatus.Active };
            sA.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
            // Archived on purpose: explicitly requested by id it must still be readable.
            var sB = new Season { OwnerId = ownerId, Name = "SFR 2031", StartDate = D(2031, 1, 1), EndDate = D(2031, 12, 31), Status = SeasonStatus.Archived };
            sB.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
            db.Seasons.AddRange(sA, sB);

            // A season the soccer coach can't reach: owned by the basketball coach,
            // participating team is theirs too.
            var foreignTeam = new Team { Name = "SFR Foreign Hoops", SportId = 2, CoachId = foreignOwnerId };
            db.Teams.Add(foreignTeam);
            await db.SaveChangesAsync();
            var sF = new Season { OwnerId = foreignOwnerId, Name = "SFR Foreign", StartDate = D(2030, 1, 1), EndDate = D(2030, 12, 31), Status = SeasonStatus.Active };
            sF.SeasonTeams.Add(new SeasonTeam { TeamId = foreignTeam.Id });
            db.Seasons.Add(sF);

            var player = new Player { FullName = "SFR Player", Age = 20, SportId = 1, PositionId = 1, TeamId = team.Id };
            db.Players.Add(player);
            var period = new AssessmentPeriod { Name = "SFR Period", TeamId = team.Id, StartDate = D(2029, 1, 1), EndDate = D(2035, 12, 31) };
            db.AssessmentPeriods.Add(period);
            await db.SaveChangesAsync();

            // One row per season bucket on every wired entity: A-stamped, B-stamped
            // where useful, and null-stamped (pre-season / roster-gap shaped).
            var mA = new MatchResult { TeamId = team.Id, OpponentName = "SFR Opp A", MatchDate = D(2030, 3, 15), ScoreFormat = ScoreFormat.Goals, SeasonId = sA.Id };
            var mB = new MatchResult { TeamId = team.Id, OpponentName = "SFR Opp B", MatchDate = D(2031, 3, 1), ScoreFormat = ScoreFormat.Goals, SeasonId = sB.Id };
            var mNull = new MatchResult { TeamId = team.Id, OpponentName = "SFR Opp Null", MatchDate = D(2029, 5, 5), ScoreFormat = ScoreFormat.Goals };
            db.MatchResults.AddRange(mA, mB, mNull);
            await db.SaveChangesAsync();

            db.PlayerMatchRatings.AddRange(
                new PlayerMatchRating { MatchResultId = mA.Id, PlayerId = player.Id, Rating = 8.0m },
                new PlayerMatchRating { MatchResultId = mNull.Id, PlayerId = player.Id, Rating = 6.0m });

            var category = await db.SportStatCategories.FirstAsync(c => c.SportId == 1);
            var aA = new PlayerAssessment { PlayerId = player.Id, AssessmentPeriodId = period.Id, DateRecorded = D(2030, 3, 15), SeasonId = sA.Id };
            var aNull = new PlayerAssessment { PlayerId = player.Id, AssessmentPeriodId = period.Id, DateRecorded = D(2029, 5, 5) };
            db.PlayerAssessments.AddRange(aA, aNull);
            await db.SaveChangesAsync();
            db.PlayerStatScores.AddRange(
                new PlayerStatScore { PlayerAssessmentId = aA.Id, SportStatCategoryId = category.Id, Score = 8.0m },
                new PlayerStatScore { PlayerAssessmentId = aNull.Id, SportStatCategoryId = category.Id, Score = 2.0m });

            var metric = await db.SportMetricDefinitions.FirstAsync(d => d.SportId == 1);
            db.ObjectiveTestResults.AddRange(
                new ObjectiveTestResult { PlayerId = player.Id, MetricDefinitionId = metric.Id, Value = 5, Unit = "", TestedAt = D(2030, 3, 15), TestedBy = TestedByType.Coach, SeasonId = sA.Id },
                new ObjectiveTestResult { PlayerId = player.Id, MetricDefinitionId = metric.Id, Value = 6, Unit = "", TestedAt = D(2029, 5, 5), TestedBy = TestedByType.Coach });

            db.MatchPerformances.AddRange(
                new MatchPerformance { PlayerId = player.Id, MatchDate = D(2030, 3, 15), Opponent = "SFR MP A", PerformanceRating = 8, SeasonId = sA.Id },
                new MatchPerformance { PlayerId = player.Id, MatchDate = D(2029, 5, 5), Opponent = "SFR MP Null", PerformanceRating = 5 });

            db.ImprovementPlans.AddRange(
                new ImprovementPlan { PlayerId = player.Id, WeeklyGoals = "SFR Plan A", SeasonId = sA.Id },
                new ImprovementPlan { PlayerId = player.Id, WeeklyGoals = "SFR Plan Null" });

            db.TrainingSessions.AddRange(
                new TrainingSession { PlayerId = player.Id, TeamId = team.Id, Date = D(2030, 3, 15), DurationMinutes = 90, AttendanceStatus = AttendanceStatus.Present, SeasonId = sA.Id },
                new TrainingSession { PlayerId = player.Id, TeamId = team.Id, Date = D(2029, 5, 5), DurationMinutes = 60, AttendanceStatus = AttendanceStatus.Present });

            db.ScheduledSessions.AddRange(
                new ScheduledSession { TeamId = team.Id, Title = "SFR Session A", SessionType = SessionType.Training, StartTime = D(2030, 3, 15), DurationMinutes = 60, SeasonId = sA.Id },
                new ScheduledSession { TeamId = team.Id, Title = "SFR Session Null", SessionType = SessionType.Training, StartTime = D(2029, 5, 5), DurationMinutes = 60 });

            // Injuries are season-scoped by WINDOW OVERLAP (span-bearing ruling), not FK:
            // one inside season A's window, one entirely before it.
            db.InjuryRecords.AddRange(
                new InjuryRecord { PlayerId = player.Id, InjuryDate = D(2030, 2, 1), InjuryType = "SFR Strain In A", Severity = InjurySeverity.Minor, RecoveryStatus = RecoveryStatus.FullyRecovered, RecoveredDate = D(2030, 2, 20) },
                new InjuryRecord { PlayerId = player.Id, InjuryDate = D(2028, 2, 1), InjuryType = "SFR Strain Outside", Severity = InjurySeverity.Minor, RecoveryStatus = RecoveryStatus.FullyRecovered, RecoveredDate = D(2028, 2, 20) });
            await db.SaveChangesAsync();
        }

        f.TeamId = (await db.Teams.SingleAsync(t => t.Name == "SFR United")).Id;
        f.SeasonAId = (await db.Seasons.SingleAsync(s => s.Name == "SFR 2030")).Id;
        f.SeasonBId = (await db.Seasons.SingleAsync(s => s.Name == "SFR 2031")).Id;
        f.ForeignSeasonId = (await db.Seasons.SingleAsync(s => s.Name == "SFR Foreign")).Id;
        f.PlayerId = (await db.Players.SingleAsync(p => p.FullName == "SFR Player")).Id;
        f.MatchAId = (await db.MatchResults.SingleAsync(m => m.OpponentName == "SFR Opp A")).Id;
        f.MatchBId = (await db.MatchResults.SingleAsync(m => m.OpponentName == "SFR Opp B")).Id;
        f.MatchNullId = (await db.MatchResults.SingleAsync(m => m.OpponentName == "SFR Opp Null")).Id;
        f.AssessmentAId = (await db.PlayerAssessments.OrderBy(a => a.Id).FirstAsync(a => a.PlayerId == f.PlayerId && a.SeasonId != null)).Id;
        f.AssessmentNullId = (await db.PlayerAssessments.OrderBy(a => a.Id).FirstAsync(a => a.PlayerId == f.PlayerId && a.SeasonId == null)).Id;
        return f;
    }

    private sealed class ItemWithId
    {
        public int Id { get; set; }
    }

    private static async Task<List<ItemWithId>> ReadListAsync(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<List<ItemWithId>>>())!.Data!;
    }

    private Task<HttpClient> CoachAsync() =>
        TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

    // ── Opt-in default + filter semantics + Archived-by-id (matches) ─────────

    [Fact]
    public async Task Matches_unfiltered_unchanged_filtered_excludes_null_and_archived_is_readable()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        // No parameter: exactly today's behaviour — all three rows, null stamp included.
        var all = await ReadListAsync(await coach.GetAsync($"/api/teams/{f.TeamId}/matches"));
        Assert.Equal(new[] { f.MatchAId, f.MatchBId, f.MatchNullId }.OrderBy(i => i),
            all.Select(m => m.Id).OrderBy(i => i));

        // Filtered: only season A's row; the null-stamped row is excluded.
        var filtered = await ReadListAsync(await coach.GetAsync($"/api/teams/{f.TeamId}/matches?seasonId={f.SeasonAId}"));
        Assert.Equal(new[] { f.MatchAId }, filtered.Select(m => m.Id));

        // Archived season, explicitly requested by id: readable, never a failure.
        var archived = await ReadListAsync(await coach.GetAsync($"/api/teams/{f.TeamId}/matches?seasonId={f.SeasonBId}"));
        Assert.Equal(new[] { f.MatchBId }, archived.Select(m => m.Id));
    }

    // ── The 404 contract, list endpoint ──────────────────────────────────────

    [Fact]
    public async Task Matches_filter_404s_on_missing_and_on_inaccessible_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var missing = await coach.GetAsync($"/api/teams/{f.TeamId}/matches?seasonId={MissingSeasonId}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        // Another account's season: 404, not 403 and not an empty list.
        var foreign = await coach.GetAsync($"/api/teams/{f.TeamId}/matches?seasonId={f.ForeignSeasonId}");
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }

    // ── Ratings follow their parent match's season ───────────────────────────

    [Fact]
    public async Task Match_ratings_filter_by_parent_match_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var all = await ReadListAsync(await coach.GetAsync($"/api/players/{f.PlayerId}/match-ratings"));
        Assert.Equal(2, all.Count);

        var filtered = await ReadListAsync(await coach.GetAsync($"/api/players/{f.PlayerId}/match-ratings?seasonId={f.SeasonAId}"));
        Assert.Single(filtered);
    }

    // ── Player-context lists: assessments, tests, performances, plans ────────

    [Fact]
    public async Task Player_context_lists_filter_and_exclude_null_stamps()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var assessments = await ReadListAsync(await coach.GetAsync($"/api/player-assessments/player/{f.PlayerId}?seasonId={f.SeasonAId}"));
        Assert.Equal(new[] { f.AssessmentAId }, assessments.Select(a => a.Id));
        var assessmentsAll = await ReadListAsync(await coach.GetAsync($"/api/player-assessments/player/{f.PlayerId}"));
        Assert.Equal(2, assessmentsAll.Count);

        var tests = await ReadListAsync(await coach.GetAsync($"/api/players/{f.PlayerId}/objective-tests?seasonId={f.SeasonAId}"));
        Assert.Single(tests);
        var testsAll = await ReadListAsync(await coach.GetAsync($"/api/players/{f.PlayerId}/objective-tests"));
        Assert.Equal(2, testsAll.Count);

        var performances = await ReadListAsync(await coach.GetAsync($"/api/match-performance/player/{f.PlayerId}?seasonId={f.SeasonAId}"));
        Assert.Single(performances);

        var plans = await ReadListAsync(await coach.GetAsync($"/api/improvement-plans/player/{f.PlayerId}?seasonId={f.SeasonAId}"));
        Assert.Single(plans);
    }

    // ── The three suppressed-index types that ARE wired (no-index ruling) ────

    [Fact]
    public async Task Training_and_scheduled_session_lists_filter_by_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var teamSessions = await ReadListAsync(await coach.GetAsync($"/api/training-sessions/team/{f.TeamId}?seasonId={f.SeasonAId}"));
        Assert.Single(teamSessions);
        var teamSessionsAll = await ReadListAsync(await coach.GetAsync($"/api/training-sessions/team/{f.TeamId}"));
        Assert.Equal(2, teamSessionsAll.Count);

        var playerSessions = await ReadListAsync(await coach.GetAsync($"/api/training-sessions/player/{f.PlayerId}?seasonId={f.SeasonAId}"));
        Assert.Single(playerSessions);

        var scheduled = await ReadListAsync(await coach.GetAsync($"/api/teams/{f.TeamId}/sessions?seasonId={f.SeasonAId}"));
        Assert.Single(scheduled);
        var scheduledAll = await ReadListAsync(await coach.GetAsync($"/api/teams/{f.TeamId}/sessions"));
        Assert.Equal(2, scheduledAll.Count);
    }

    // ── Aggregates ───────────────────────────────────────────────────────────

    private sealed class TeamReportSlim
    {
        public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
        public int? UnassignedCount { get; set; }
        public SeasonRecordCountsDto? SeasonRecords { get; set; }
        public List<SeasonRosterStintDto>? SeasonRoster { get; set; }
    }

    // §5h retired the RosterIsCurrentNotHistorical flag: the filtered report is now
    // genuinely historical (stint roster ∪ the arm-2 edge + stamped records). The
    // fixture player has stamped season-A records and no stint anywhere, so arm 2
    // keeps them in the filtered population — averages unchanged from S4.
    [Fact]
    public async Task Team_report_filters_averages_and_is_historical_not_flagged()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        // Unfiltered: both assessments (8.0 and 2.0) -> average 5.0; no §5h fields.
        var allResponse = await coach.GetAsync($"/api/reports/team/{f.TeamId}");
        allResponse.EnsureSuccessStatusCode();
        var all = (await allResponse.Content.ReadFromJsonAsync<TestApiResponse<TeamReportSlim>>())!.Data!;
        Assert.Equal(5.0, all.AverageScoreByCategory.Values.Single());
        Assert.Null(all.UnassignedCount);
        Assert.Null(all.SeasonRecords);
        Assert.Null(all.SeasonRoster);

        // Season A only: just the 8.0 assessment feeds the average (via arm 2), and
        // the §5h season sections are present.
        var filteredResponse = await coach.GetAsync($"/api/reports/team/{f.TeamId}?seasonId={f.SeasonAId}");
        filteredResponse.EnsureSuccessStatusCode();
        var filtered = (await filteredResponse.Content.ReadFromJsonAsync<TestApiResponse<TeamReportSlim>>())!.Data!;
        Assert.Equal(8.0, filtered.AverageScoreByCategory.Values.Single());
        Assert.NotNull(filtered.UnassignedCount);
        Assert.NotNull(filtered.SeasonRecords);
        Assert.NotNull(filtered.SeasonRoster);
    }

    [Fact]
    public async Task Team_report_404s_on_missing_and_on_inaccessible_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var missing = await coach.GetAsync($"/api/reports/team/{f.TeamId}?seasonId={MissingSeasonId}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        var foreign = await coach.GetAsync($"/api/reports/team/{f.TeamId}?seasonId={f.ForeignSeasonId}");
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }

    private sealed class PlayerReportSlim
    {
        public List<ItemWithId> Assessments { get; set; } = new();
        public List<InjurySlim> Injuries { get; set; } = new();
        public List<ItemWithId> RecentMatches { get; set; } = new();
    }

    private sealed class InjurySlim
    {
        public string InjuryType { get; set; } = "";
    }

    [Fact]
    public async Task Player_report_filters_assessments_matches_and_injuries_by_window_overlap()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var response = await coach.GetAsync($"/api/reports/player/{f.PlayerId}?seasonId={f.SeasonAId}");
        response.EnsureSuccessStatusCode();
        var report = (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerReportSlim>>())!.Data!;

        Assert.Equal(new[] { f.AssessmentAId }, report.Assessments.Select(a => a.Id));
        Assert.Single(report.RecentMatches);
        // Injuries have no SeasonId: window overlap keeps the in-season one, drops 2028.
        Assert.Equal(new[] { "SFR Strain In A" }, report.Injuries.Select(i => i.InjuryType));

        var unfiltered = await coach.GetAsync($"/api/reports/player/{f.PlayerId}");
        unfiltered.EnsureSuccessStatusCode();
        var career = (await unfiltered.Content.ReadFromJsonAsync<TestApiResponse<PlayerReportSlim>>())!.Data!;
        Assert.Equal(2, career.Assessments.Count);
        Assert.Equal(2, career.Injuries.Count);
    }

    private sealed class DashboardSlim
    {
        public int TotalAssessments { get; set; }
    }

    [Fact]
    public async Task Player_dashboard_filters_assessment_totals()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var coach = await CoachAsync();

        var filtered = await coach.GetAsync($"/api/dashboard/player/{f.PlayerId}?seasonId={f.SeasonAId}");
        filtered.EnsureSuccessStatusCode();
        Assert.Equal(1, (await filtered.Content.ReadFromJsonAsync<TestApiResponse<DashboardSlim>>())!.Data!.TotalAssessments);

        var all = await coach.GetAsync($"/api/dashboard/player/{f.PlayerId}");
        all.EnsureSuccessStatusCode();
        Assert.Equal(2, (await all.Content.ReadFromJsonAsync<TestApiResponse<DashboardSlim>>())!.Data!.TotalAssessments);
    }
}
