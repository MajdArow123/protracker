using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 §5h: the historical team report. Rulings under test:
// - Q1/Q2 two-arm population: the roster listing is stint-driven (direct
//   season-keyed query); per-player inclusion = stint roster ∪ current members
//   with season-stamped records AND no season stint on ANY team (the narrowed
//   point-in-time arm). A stint player with zero records renders honest empties.
// - Arm-2 narrowing: a post-season transferee's old-team stamps never leak into
//   the new team's report.
// - Q3: no re-windowing — a stamped record outside the stint's date window still
//   counts (the stamps are the windowed truth).
// - Departed players render without crashing (the old team.Players.First() risk).
// - Q4: UnassignedCount = team-context nulls + population player-context nulls.
// - Q5: the team season selector is participation-scoped.
public class SeasonHistoricalReportTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonHistoricalReportTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static DateTime U(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

    private sealed class Graph
    {
        public HttpClient Client = null!;
        public string OwnerId = "";
        public int TeamId, SeasonId, PeriodId;
    }

    private async Task<Graph> BuildAsync(string tag)
    {
        var g = new Graph { Client = _factory.CreateClient() };
        var email = $"hist.{tag}.{Guid.NewGuid():N}@hist.test";
        (await g.Client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = $"Hist Coach {tag}", email, password = "Hist1234!", role = "Coach",
        })).EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        g.OwnerId = (await db.Users.SingleAsync(u => u.Email == email)).Id;
        var team = new Team { Name = $"Hist Team {tag}", SportId = 1, CoachId = g.OwnerId };
        db.Teams.Add(team);
        await db.SaveChangesAsync();
        db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = g.OwnerId, TeamId = team.Id });
        var season = new Season
        {
            OwnerId = g.OwnerId, Name = $"Hist Season {tag}",
            StartDate = U(2020, 1, 1), EndDate = U(2020, 6, 30), Status = SeasonStatus.Active,
        };
        season.SeasonTeams.Add(new SeasonTeam { TeamId = team.Id });
        db.Seasons.Add(season);
        var period = new AssessmentPeriod { Name = $"Hist Period {tag}", TeamId = team.Id, StartDate = U(2019, 1, 1), EndDate = U(2029, 1, 1) };
        db.AssessmentPeriods.Add(period);
        await db.SaveChangesAsync();
        (g.TeamId, g.SeasonId, g.PeriodId) = (team.Id, season.Id, period.Id);
        return g;
    }

    private async Task<int> AddPlayerAsync(Graph g, string name, int? teamId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var p = new Player { FullName = name, Age = 20, SportId = 1, PositionId = 1, TeamId = teamId };
        db.Players.Add(p);
        await db.SaveChangesAsync();
        return p.Id;
    }

    private async Task AddStintAsync(int playerId, int seasonId, int teamId, DateTime joined, DateTime? left = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.SeasonRosters.Add(new SeasonRoster
        {
            PlayerId = playerId, SeasonId = seasonId, TeamId = teamId,
            JoinedAt = joined, LeftAt = left, Source = StintSource.Manual,
        });
        await db.SaveChangesAsync();
    }

    private async Task AddAssessmentAsync(Graph g, int playerId, DateTime date, int? seasonId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.PlayerAssessments.Add(new PlayerAssessment
        {
            PlayerId = playerId, AssessmentPeriodId = g.PeriodId, DateRecorded = date, SeasonId = seasonId,
        });
        await db.SaveChangesAsync();
    }

    private async Task<TeamReportDto> ReportAsync(Graph g, int teamId, int? seasonId = null)
    {
        var url = $"/api/reports/team/{teamId}" + (seasonId != null ? $"?seasonId={seasonId}" : "");
        var response = await g.Client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<TeamReportDto>>())!.Data!;
    }

    [Fact]
    public async Task Two_arm_population_stint_player_shows_empty_and_stamped_stintless_member_appears_via_arm2()
    {
        var g = await BuildAsync("pop");
        // Alpha: stint in the season, ZERO stamped records — must appear with honest
        // empty values AND in the roster listing.
        var alpha = await AddPlayerAsync(g, "Hist Alpha", g.TeamId);
        await AddStintAsync(alpha, g.SeasonId, g.TeamId, U(2020, 1, 10));
        // Beta: current member, stamped assessment, NO stint anywhere — arm 2.
        var beta = await AddPlayerAsync(g, "Hist Beta", g.TeamId);
        await AddAssessmentAsync(g, beta, U(2020, 3, 1), g.SeasonId);
        // Gamma: current member with NO season involvement at all — not in the
        // filtered population (this is what "historical" means).
        var gamma = await AddPlayerAsync(g, "Hist Gamma", g.TeamId);

        var filtered = await ReportAsync(g, g.TeamId, g.SeasonId);
        Assert.Equal(2, filtered.PlayerCount);
        Assert.Contains(filtered.PlayerAverageScores, p => p.PlayerId == alpha && p.AverageScore == 0 && p.AssessmentCount == 0);
        Assert.Contains(filtered.PlayerAverageScores, p => p.PlayerId == beta && p.AssessmentCount == 1);
        Assert.DoesNotContain(filtered.PlayerAverageScores, p => p.PlayerId == gamma);
        // "Stints decide the roster listing": alpha only.
        var stint = Assert.Single(filtered.SeasonRoster!);
        Assert.Equal(alpha, stint.PlayerId);

        // Unfiltered stays the current-roster view: all three.
        var all = await ReportAsync(g, g.TeamId);
        Assert.Equal(3, all.PlayerCount);
        Assert.Null(all.SeasonRoster);
        Assert.Contains(all.PlayerAverageScores, p => p.PlayerId == gamma && p.AssessmentCount == null);
    }

    [Fact]
    public async Task Arm2_narrowing_transferees_old_team_stamps_do_not_leak_into_the_new_team()
    {
        var g = await BuildAsync("leak");
        int teamU;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var u = new Team { Name = "Hist Team U leak", SportId = 1, CoachId = g.OwnerId };
            db.Teams.Add(u);
            await db.SaveChangesAsync();
            db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = g.OwnerId, TeamId = u.Id });
            db.SeasonTeams.Add(new SeasonTeam { SeasonId = g.SeasonId, TeamId = u.Id });
            await db.SaveChangesAsync();
            teamU = u.Id;
        }

        // The transferee: season stint on U, CURRENT member of T, stamped assessment.
        var transferee = await AddPlayerAsync(g, "Hist Transferee", g.TeamId);
        await AddStintAsync(transferee, g.SeasonId, teamU, U(2020, 1, 5), U(2020, 6, 30));
        await AddAssessmentAsync(g, transferee, U(2020, 2, 1), g.SeasonId);

        // U's report: appears (arm 1 there) with the stamped record.
        var reportU = await ReportAsync(g, teamU, g.SeasonId);
        Assert.Contains(reportU.PlayerAverageScores, p => p.PlayerId == transferee && p.AssessmentCount == 1);

        // T's report: does NOT appear — they HAVE a season stint (on U), so the
        // narrowed arm 2 excludes them; no leak, no double-count.
        var reportT = await ReportAsync(g, g.TeamId, g.SeasonId);
        Assert.DoesNotContain(reportT.PlayerAverageScores, p => p.PlayerId == transferee);
        Assert.Equal(0, reportT.PlayerCount);
    }

    [Fact]
    public async Task No_rewindowing_a_stamp_outside_the_stint_dates_still_counts()
    {
        var g = await BuildAsync("wind");
        // Partial-season stint: March only. A stamped record dated February (the
        // point-in-time shape — stamps are trusted, never re-windowed) still counts.
        var p = await AddPlayerAsync(g, "Hist Partial", g.TeamId);
        await AddStintAsync(p, g.SeasonId, g.TeamId, U(2020, 3, 1), U(2020, 3, 31));
        await AddAssessmentAsync(g, p, U(2020, 2, 10), g.SeasonId);
        await AddAssessmentAsync(g, p, U(2020, 3, 15), g.SeasonId);

        var filtered = await ReportAsync(g, g.TeamId, g.SeasonId);
        var row = Assert.Single(filtered.PlayerAverageScores, x => x.PlayerId == p);
        Assert.Equal(2, row.AssessmentCount); // both — no stint-date math in the report layer
    }

    [Fact]
    public async Task Departed_stint_player_renders_without_crashing_and_stays_in_the_filtered_report()
    {
        var g = await BuildAsync("gone");
        var departed = await AddPlayerAsync(g, "Hist Departed", g.TeamId);
        await AddStintAsync(departed, g.SeasonId, g.TeamId, U(2020, 1, 10), U(2020, 5, 1));
        await AddAssessmentAsync(g, departed, U(2020, 2, 1), g.SeasonId);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // The player left the club: no longer in team.Players (the old
            // First() crash shape).
            var player = await db.Players.SingleAsync(x => x.Id == departed);
            player.TeamId = null;
            await db.SaveChangesAsync();
        }

        var filtered = await ReportAsync(g, g.TeamId, g.SeasonId);
        Assert.Contains(filtered.PlayerAverageScores, x => x.PlayerId == departed && x.AssessmentCount == 1);
        Assert.Contains(filtered.Players, x => x.Id == departed);

        var all = await ReportAsync(g, g.TeamId);
        Assert.DoesNotContain(all.PlayerAverageScores, x => x.PlayerId == departed);
    }

    [Fact]
    public async Task UnassignedCount_matches_the_pinned_definition()
    {
        var g = await BuildAsync("unas");
        var p = await AddPlayerAsync(g, "Hist Unassigned", g.TeamId);
        await AddStintAsync(p, g.SeasonId, g.TeamId, U(2020, 1, 10));
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // Team-context nulls: one match + one training session.
            db.MatchResults.Add(new MatchResult { TeamId = g.TeamId, OpponentName = "Hist Null FC", MatchDate = U(2020, 2, 1), HomeScore = 1, AwayScore = 0, IsHome = true });
            db.TrainingSessions.Add(new TrainingSession { PlayerId = p, TeamId = g.TeamId, Date = U(2020, 2, 2), DurationMinutes = 60, AttendanceStatus = AttendanceStatus.Present });
            await db.SaveChangesAsync();
        }
        // Player-context null of a population player.
        await AddAssessmentAsync(g, p, U(2020, 2, 3), null);
        // And a stamped one, which must NOT count as unassigned.
        await AddAssessmentAsync(g, p, U(2020, 3, 3), g.SeasonId);

        var filtered = await ReportAsync(g, g.TeamId, g.SeasonId);
        Assert.Equal(3, filtered.UnassignedCount); // match + session + null assessment
        // The null-stamped rows are NOT season records — they're the disclosure.
        Assert.Equal(0, filtered.SeasonRecords!.Matches);
        Assert.Equal(0, filtered.SeasonRecords!.TrainingSessions);

        var all = await ReportAsync(g, g.TeamId);
        Assert.Null(all.UnassignedCount);
    }

    // Q5 pin: the team season selector is participation-scoped — an owned season
    // WITHOUT a SeasonTeam row for this team never appears in its selector feed.
    [Fact]
    public async Task Team_seasons_endpoint_is_participation_scoped()
    {
        var g = await BuildAsync("sel");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // A second owned season with NO participation for this team.
            db.Seasons.Add(new Season
            {
                OwnerId = g.OwnerId, Name = "Hist Unrelated Season",
                StartDate = U(2021, 1, 1), EndDate = U(2021, 6, 30), Status = SeasonStatus.Active,
            });
            await db.SaveChangesAsync();
        }

        var response = await g.Client.GetAsync($"/api/teams/{g.TeamId}/seasons");
        response.EnsureSuccessStatusCode();
        var seasons = (await response.Content.ReadFromJsonAsync<TestApiResponse<List<SeasonDto>>>())!.Data!;
        var only = Assert.Single(seasons);
        Assert.Equal(g.SeasonId, only.Id);
    }
}
