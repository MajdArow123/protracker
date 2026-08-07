using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S6: the SeasonRoster write path. The rulings under test:
// (1) at most one stint per (player, season) covering any date — overlap is a 400
//     naming the conflicting stint's team and dates; sequential stints are legal;
// (2) JoinedAt required; LeftAt >= JoinedAt (nothing else validates it);
// (3) the stint's team must participate in the season (400 otherwise);
// (4) saving a stint never retroactively stamps — the save response carries the
//     unstamped-in-window count instead (EvidenceBasedScores excluded);
// (5) writes are CanManagePlayers-gated on the STINT's team, never Player.TeamId;
//     a coach not on the stint's team gets the same 404 as a missing stint.
public class SeasonRosterTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonRosterTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // Timezone-independent midnight UTC (the wire shape the date inputs produce).
    private static DateTime U(string yyyyMmDd) =>
        DateTime.SpecifyKind(DateTime.Parse(yyyyMmDd), DateTimeKind.Utc);

    private static CreateSeasonDto SeasonDto(string name, string start, string end) => new()
    {
        Name = name,
        StartDate = U(start),
        EndDate = U(end),
        Status = "Active",
    };

    private static SaveSeasonRosterStintDto Stint(
        int playerId, int teamId, string? joined, string? left = null, int? jersey = null, int? positionId = null) => new()
    {
        PlayerId = playerId,
        TeamId = teamId,
        JoinedAt = joined == null ? null : U(joined),
        LeftAt = left == null ? null : U(left),
        JerseyNumber = jersey,
        PositionId = positionId,
    };

    private static async Task<SeasonDto> CreateSeasonAsync(HttpClient client, int teamId, CreateSeasonDto dto)
    {
        var response = await client.PostAsJsonAsync($"/api/teams/{teamId}/seasons", dto);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<SeasonDto>>())!.Data!;
    }

    private static async Task<SeasonRosterSaveResultDto> CreateStintAsync(
        HttpClient client, int seasonId, SaveSeasonRosterStintDto dto)
    {
        var response = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", dto);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<SeasonRosterSaveResultDto>>())!.Data!;
    }

    [Fact]
    public async Task Create_edit_end_and_delete_a_stint_roundtrip()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Roundtrip", "2040-01-01", "2040-06-30"));

        var created = await CreateStintAsync(coach, season.Id,
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2040-01-01", jersey: 10, positionId: 1));
        Assert.Equal(TestAuth.LucasWardPlayerId, created.Stint.PlayerId);
        Assert.Equal("Lucas Ward", created.Stint.PlayerName);
        Assert.False(string.IsNullOrEmpty(created.Stint.TeamName));
        Assert.Equal(10, created.Stint.JerseyNumber);
        Assert.False(string.IsNullOrEmpty(created.Stint.PositionName));
        Assert.Null(created.Stint.LeftAt);

        // End the stint (an edit that sets LeftAt) — identity fields sent unchanged.
        var ended = await coach.PutAsJsonAsync($"/api/season-roster/{created.Stint.Id}",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2040-01-01", "2040-03-31", jersey: 10, positionId: 1));
        ended.EnsureSuccessStatusCode();
        var endedResult = (await ended.Content.ReadFromJsonAsync<TestApiResponse<SeasonRosterSaveResultDto>>())!.Data!;
        Assert.Equal(U("2040-03-31"), endedResult.Stint.LeftAt);

        // The list read reflects it; then delete restores an empty roster.
        var list = (await coach.GetFromJsonAsync<TestApiResponse<List<SeasonRosterStintDto>>>(
            $"/api/seasons/{season.Id}/roster"))!.Data!;
        Assert.Single(list);
        Assert.Equal(HttpStatusCode.NoContent, (await coach.DeleteAsync($"/api/season-roster/{created.Stint.Id}")).StatusCode);
        list = (await coach.GetFromJsonAsync<TestApiResponse<List<SeasonRosterStintDto>>>(
            $"/api/seasons/{season.Id}/roster"))!.Data!;
        Assert.Empty(list);

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Missing_join_date_and_inverted_dates_are_400()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Dates", "2041-01-01", "2041-06-30"));

        // Ruling: JoinedAt is REQUIRED — an undated stint silently does nothing.
        var noJoin = await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, joined: null));
        Assert.Equal(HttpStatusCode.BadRequest, noJoin.StatusCode);

        // §5b: LeftAt before JoinedAt was validated NOWHERE before S6.
        var inverted = await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2041-03-01", "2041-02-01"));
        Assert.Equal(HttpStatusCode.BadRequest, inverted.StatusCode);

        // Bad jersey and cross-sport position are 400s too, never silent fixes.
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2041-01-01", jersey: 1000))).StatusCode);
        int foreignPositionId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            foreignPositionId = (await db.Positions.FirstAsync(p => p.SportId == 2)).Id;
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2041-01-01", positionId: foreignPositionId))).StatusCode);

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    // Ruling 1: "no overlapping stints", not "no two stints". Day-granular: a leave day
    // counts wholly, so rejoining on the leave day is an overlap; the day after is legal.
    [Fact]
    public async Task Overlapping_stints_in_one_season_are_400_naming_team_and_dates_but_sequential_stints_are_legal()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Overlap", "2042-01-01", "2042-12-31"));

        await CreateStintAsync(coach, season.Id,
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2042-01-01", "2042-03-31"));

        // Overlapping window → 400 whose message names the conflicting team and dates.
        var overlap = await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2042-02-15"));
        Assert.Equal(HttpStatusCode.BadRequest, overlap.StatusCode);
        var body = await overlap.Content.ReadAsStringAsync();
        Assert.Contains("City FC U18", body);
        Assert.Contains("2042-01-01", body);
        Assert.Contains("2042-03-31", body);

        // Same-day boundary: joining ON the leave day is still an overlap (both stints
        // would cover that whole day — the resolver counts both days wholly).
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2042-03-31"))).StatusCode);

        // The day after the leave: a legal sequential stint (mid-season rejoin).
        var rejoin = await CreateStintAsync(coach, season.Id,
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2042-04-01"));
        Assert.NotNull(rejoin.Stint);

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    // Overlap across DIFFERENT seasons stays legal — that's the documented Ambiguous
    // state (overlapping seasons are allowed), not a conflict.
    [Fact]
    public async Task Overlapping_stints_across_different_seasons_are_allowed()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var seasonA = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Cross A", "2043-01-01", "2043-12-31"));
        var seasonB = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Cross B", "2043-06-01", "2044-05-31"));

        await CreateStintAsync(coach, seasonA.Id, Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2043-01-01"));
        await CreateStintAsync(coach, seasonB.Id, Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2043-06-01"));

        (await coach.DeleteAsync($"/api/seasons/{seasonA.Id}")).EnsureSuccessStatusCode();
        (await coach.DeleteAsync($"/api/seasons/{seasonB.Id}")).EnsureSuccessStatusCode();
    }

    // Ruling 2 guard: the resolver ignores stint TeamId, so a roster row on a
    // non-participating team would still resolve — the service must make it unrepresentable.
    [Fact]
    public async Task Rostering_into_a_team_that_does_not_participate_in_the_season_is_400()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Participation", "2044-01-01", "2044-06-30"));

        var response = await coach.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.MarcusBellPlayerId, TestAuth.BasketballTeamId, "2044-01-01"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("participate", await response.Content.ReadAsStringAsync());

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Assistant_needs_CanManagePlayers_to_write_stints()
    {
        var headCoach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(headCoach, TestAuth.SoccerTeamId, SeasonDto("RST Assistant", "2045-01-01", "2045-06-30"));

        var limited = await CreateAssistantAsync(headCoach, "roster.assistant.limited@protracker.test",
            new CoachPermissionsDto { CanAssessPlayers = true });
        Assert.Equal(HttpStatusCode.Forbidden, (await limited.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2045-01-01"))).StatusCode);

        var manager = await CreateAssistantAsync(headCoach, "roster.assistant.manager@protracker.test",
            new CoachPermissionsDto { CanManagePlayers = true });
        var created = await CreateStintAsync(manager, season.Id,
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2045-01-01"));
        Assert.NotNull(created.Stint);

        (await headCoach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    // §5g: write permission scopes to the STINT's team, never Player.TeamId — ending or
    // fixing a departed player's stint must keep working after they leave the team.
    [Fact]
    public async Task Stint_writes_keep_working_after_the_player_leaves_the_team()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Departed", "2046-01-01", "2046-06-30"));

        int playerId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var player = new Player { FullName = "RST Departed Player", Age = 19, SportId = 1, PositionId = 1, TeamId = TestAuth.SoccerTeamId };
            db.Players.Add(player);
            await db.SaveChangesAsync();
            playerId = player.Id;
        }

        var created = await CreateStintAsync(coach, season.Id, Stint(playerId, TestAuth.SoccerTeamId, "2046-01-01"));

        // The player departs: current membership gone, the stint remains the team's record.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var player = await db.Players.FirstAsync(p => p.Id == playerId);
            player.TeamId = null;
            await db.SaveChangesAsync();
        }

        // Ending the stint still works — permission came from the stint's team.
        var ended = await coach.PutAsJsonAsync($"/api/season-roster/{created.Stint.Id}",
            Stint(playerId, TestAuth.SoccerTeamId, "2046-01-01", "2046-03-01"));
        ended.EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NoContent, (await coach.DeleteAsync($"/api/season-roster/{created.Stint.Id}")).StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Players.Remove(await db.Players.FirstAsync(p => p.Id == playerId));
            await db.SaveChangesAsync();
        }
        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Foreign_players_are_403_and_foreign_stints_are_404_never_a_leak()
    {
        var soccer = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var basketball = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        // A coach cannot roster a player they can't access — the app-wide player
        // contract is a 403 from EnsureCanAccessPlayerAsync (unlike the season 404 rule).
        var hoopsSeason = await CreateSeasonAsync(basketball, TestAuth.BasketballTeamId, SeasonDto("RST Hoops", "2047-01-01", "2047-06-30"));
        Assert.Equal(HttpStatusCode.Forbidden, (await basketball.PostAsJsonAsync($"/api/seasons/{hoopsSeason.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.BasketballTeamId, "2047-01-01"))).StatusCode);

        // A foreign coach touching someone else's stint gets the same 404 as a missing
        // stint — never a 403 that confirms the id exists.
        var soccerSeason = await CreateSeasonAsync(soccer, TestAuth.SoccerTeamId, SeasonDto("RST Foreign Stint", "2047-01-01", "2047-06-30"));
        var stint = await CreateStintAsync(soccer, soccerSeason.Id, Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2047-01-01"));
        Assert.Equal(HttpStatusCode.NotFound, (await basketball.PutAsJsonAsync($"/api/season-roster/{stint.Stint.Id}",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2047-01-01", "2047-02-01"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await basketball.DeleteAsync($"/api/season-roster/{stint.Stint.Id}")).StatusCode);
        // And the roster list of a season they can't read is the uniform season 404.
        Assert.Equal(HttpStatusCode.NotFound, (await basketball.GetAsync($"/api/seasons/{soccerSeason.Id}/roster")).StatusCode);

        (await soccer.DeleteAsync($"/api/seasons/{soccerSeason.Id}")).EnsureSuccessStatusCode();
        (await basketball.DeleteAsync($"/api/seasons/{hoopsSeason.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Athlete_on_a_participating_team_can_read_the_roster_but_not_write_it()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Athlete Read", "2048-01-01", "2048-06-30"));
        await CreateStintAsync(coach, season.Id, Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2048-01-01"));

        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        var list = (await athlete.GetFromJsonAsync<TestApiResponse<List<SeasonRosterStintDto>>>(
            $"/api/seasons/{season.Id}/roster"))!.Data!;
        Assert.Single(list);
        // Role gate: athletes can never write stints.
        Assert.Equal(HttpStatusCode.Forbidden, (await athlete.PostAsJsonAsync($"/api/seasons/{season.Id}/roster",
            Stint(TestAuth.LucasWardPlayerId, TestAuth.SoccerTeamId, "2048-02-01"))).StatusCode);

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    // Ruling 3: adding a stint stamps NOTHING retroactively — the save response instead
    // counts the player's unstamped records inside the stint's effective window (stint
    // dates clamped to the season window), so the UI can say what S7 backfill would cover.
    [Fact]
    public async Task Saving_a_stint_reports_unstamped_records_in_window_and_stamps_nothing()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateSeasonAsync(coach, TestAuth.SoccerTeamId, SeasonDto("RST Count", "2049-01-01", "2049-06-30"));

        int playerId, inWindowAssessmentId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var player = new Player { FullName = "RST Count Player", Age = 19, SportId = 1, PositionId = 1, TeamId = TestAuth.SoccerTeamId };
            db.Players.Add(player);
            await db.SaveChangesAsync();
            playerId = player.Id;

            db.PlayerAssessments.AddRange(
                // Inside the stint window and unstamped → counted.
                new PlayerAssessment { PlayerId = playerId, AssessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId, DateRecorded = U("2049-03-15") },
                // Before the stint's join date → not counted.
                new PlayerAssessment { PlayerId = playerId, AssessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId, DateRecorded = U("2049-01-15") },
                // Inside the OPEN stint but after the season's EndDate → not counted
                // (the window is clamped to the season, matching the resolver).
                new PlayerAssessment { PlayerId = playerId, AssessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId, DateRecorded = U("2049-08-15") },
                // Inside the window but already stamped → not counted.
                new PlayerAssessment { PlayerId = playerId, AssessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId, DateRecorded = U("2049-04-01"), SeasonId = season.Id });
            // A second table proves the count spans the player-context record types.
            db.MatchPerformances.Add(new MatchPerformance { PlayerId = playerId, MatchDate = U("2049-03-20"), Opponent = "RST Opp", PerformanceRating = 7 });
            await db.SaveChangesAsync();
            inWindowAssessmentId = (await db.PlayerAssessments.FirstAsync(a =>
                a.PlayerId == playerId && a.DateRecorded == U("2049-03-15"))).Id;
        }

        // Stint joined Feb 1, open-ended → effective window Feb 1 – Jun 30 (season end).
        var created = await CreateStintAsync(coach, season.Id, Stint(playerId, TestAuth.SoccerTeamId, "2049-02-01"));
        Assert.Equal(2, created.UnstampedInWindow);

        // An edit re-reports the (unchanged) count, and nothing got stamped by saving.
        var updated = await coach.PutAsJsonAsync($"/api/season-roster/{created.Stint.Id}",
            Stint(playerId, TestAuth.SoccerTeamId, "2049-02-01", jersey: 4));
        updated.EnsureSuccessStatusCode();
        Assert.Equal(2, (await updated.Content.ReadFromJsonAsync<TestApiResponse<SeasonRosterSaveResultDto>>())!.Data!.UnstampedInWindow);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Null((await db.PlayerAssessments.FirstAsync(a => a.Id == inWindowAssessmentId)).SeasonId);
        }

        // Cleanup: remove the seeded player-context rows and the probe player.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.PlayerAssessments.RemoveRange(db.PlayerAssessments.Where(a => a.PlayerId == playerId));
            db.MatchPerformances.RemoveRange(db.MatchPerformances.Where(m => m.PlayerId == playerId));
            await db.SaveChangesAsync();
            db.Players.Remove(await db.Players.FirstAsync(p => p.Id == playerId));
            await db.SaveChangesAsync();
        }
        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    private async Task<HttpClient> CreateAssistantAsync(HttpClient headCoach, string email, CoachPermissionsDto permissions)
    {
        var invite = await headCoach.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/invite-coach",
            new InviteCoachDto { Email = email, Permissions = permissions });
        invite.EnsureSuccessStatusCode();
        var inviteUrl = (await invite.Content.ReadFromJsonAsync<TestApiResponse<InviteCoachResultDto>>())!.Data!.InviteUrl;
        var token = inviteUrl[(inviteUrl.LastIndexOf('/') + 1)..];
        (await _factory.CreateClient().PostAsJsonAsync("/api/assistant-invites/accept",
            new AcceptCoachInviteDto { Token = token, Password = TestAuth.SeedPassword, FullName = "Roster Assistant" }))
            .EnsureSuccessStatusCode();
        return await TestAuth.LoginAsync(_factory, email, TestAuth.SeedPassword);
    }
}
