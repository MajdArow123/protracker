using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S1a: seasons are account-owned. Ownership governs create/edit/lifecycle;
// READ access follows team participation (SeasonTeam -> CoachTeamScope), so assistant
// coaches and athletes on a participating team still see seasons. Overlapping Active
// seasons on one owner are allowed by design — activating never deactivates.
public class SeasonScopingTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonScopingTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static CreateSeasonDto Dto(string name, string start, string end, bool active = true) => new()
    {
        Name = name,
        StartDate = DateTime.Parse(start).ToUniversalTime(),
        EndDate = DateTime.Parse(end).ToUniversalTime(),
        IsActive = active,
    };

    private static async Task<SeasonDto> CreateAsync(HttpClient client, int teamId, CreateSeasonDto dto)
    {
        var response = await client.PostAsJsonAsync($"/api/teams/{teamId}/seasons", dto);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<SeasonDto>>())!.Data!;
    }

    [Fact]
    public async Task Two_overlapping_active_seasons_coexist_on_one_account()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var a = await CreateAsync(coach, TestAuth.SoccerTeamId, Dto("Overlap A", "2026-01-01", "2026-12-31"));
        var b = await CreateAsync(coach, TestAuth.SoccerTeamId, Dto("Overlap B", "2026-06-01", "2027-05-31"));

        // Activating B must NOT have deactivated A — overlap is allowed.
        var list = (await coach.GetFromJsonAsync<TestApiResponse<List<SeasonDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/seasons"))!.Data!;
        Assert.True(list.Single(s => s.Id == a.Id).IsActive);
        Assert.True(list.Single(s => s.Id == b.Id).IsActive);
        Assert.Equal("Active", list.Single(s => s.Id == a.Id).Status);

        (await coach.DeleteAsync($"/api/seasons/{a.Id}")).EnsureSuccessStatusCode();
        (await coach.DeleteAsync($"/api/seasons/{b.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Active_seasons_endpoint_is_owner_scoped()
    {
        var soccer = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var basketball = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        var mine = await CreateAsync(soccer, TestAuth.SoccerTeamId, Dto("Owner Scope Probe", "2026-01-01", "2026-12-31"));

        var soccerActive = (await soccer.GetFromJsonAsync<TestApiResponse<List<SeasonDto>>>("/api/seasons/active"))!.Data!;
        Assert.Contains(soccerActive, s => s.Id == mine.Id);

        // Another coach's active list never contains a season they don't own.
        var basketballActive = (await basketball.GetFromJsonAsync<TestApiResponse<List<SeasonDto>>>("/api/seasons/active"))!.Data!;
        Assert.DoesNotContain(basketballActive, s => s.Id == mine.Id);

        (await soccer.DeleteAsync($"/api/seasons/{mine.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Assistant_coach_reads_via_participation_but_cannot_edit_unowned_season()
    {
        var headCoach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateAsync(headCoach, TestAuth.SoccerTeamId, Dto("Assistant Visibility", "2026-01-01", "2026-12-31"));

        // Invite a scoped assistant (real CoachTeamScope row via the invite-accept flow).
        var invite = await headCoach.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/invite-coach",
            new InviteCoachDto
            {
                Email = "season.assistant@protracker.test",
                Permissions = new CoachPermissionsDto { CanAssessPlayers = true },
            });
        invite.EnsureSuccessStatusCode();
        var inviteUrl = (await invite.Content.ReadFromJsonAsync<TestApiResponse<InviteCoachResultDto>>())!.Data!.InviteUrl;
        var token = inviteUrl[(inviteUrl.LastIndexOf('/') + 1)..];
        (await _factory.CreateClient().PostAsJsonAsync("/api/assistant-invites/accept",
            new AcceptCoachInviteDto { Token = token, Password = TestAuth.SeedPassword, FullName = "Season Assistant" }))
            .EnsureSuccessStatusCode();
        var assistant = await TestAuth.LoginAsync(_factory, "season.assistant@protracker.test", TestAuth.SeedPassword);

        // Read follows participation: the assistant sees the season on their scoped team…
        var seen = (await assistant.GetFromJsonAsync<TestApiResponse<List<SeasonDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/seasons"))!.Data!;
        Assert.Contains(seen, s => s.Id == season.Id);
        var summary = await assistant.GetAsync($"/api/seasons/{season.Id}/summary");
        Assert.Equal(HttpStatusCode.OK, summary.StatusCode);

        // …but lifecycle is owner-only: edit, delete and set-current all 403.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await assistant.PutAsJsonAsync($"/api/seasons/{season.Id}", Dto("Hijack", "2026-01-01", "2026-12-31"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await assistant.DeleteAsync($"/api/seasons/{season.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await assistant.PostAsync($"/api/seasons/{season.Id}/set-current", null)).StatusCode);

        (await headCoach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Athlete_on_participating_team_can_read_seasons()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var season = await CreateAsync(coach, TestAuth.SoccerTeamId, Dto("Athlete Visibility", "2026-01-01", "2026-12-31"));

        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        var seen = (await athlete.GetFromJsonAsync<TestApiResponse<List<SeasonDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/seasons"))!.Data!;
        Assert.Contains(seen, s => s.Id == season.Id);

        (await coach.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Set_current_is_explicit_and_owner_only()
    {
        var soccer = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var basketball = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        var season = await CreateAsync(soccer, TestAuth.SoccerTeamId, Dto("Current Probe", "2026-01-01", "2026-12-31"));

        (await soccer.PostAsync($"/api/seasons/{season.Id}/set-current", null)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await basketball.PostAsync($"/api/seasons/{season.Id}/set-current", null)).StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var owner = await db.Users.SingleAsync(u => u.Email == TestAuth.SoccerCoachEmail);
            Assert.Equal(season.Id, owner.CurrentSeasonId);
        }

        // Deleting the pointed-at season clears the pointer (FK SET NULL), never blocks.
        (await soccer.DeleteAsync($"/api/seasons/{season.Id}")).EnsureSuccessStatusCode();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var owner = await db.Users.SingleAsync(u => u.Email == TestAuth.SoccerCoachEmail);
            Assert.Null(owner.CurrentSeasonId);
        }
    }
}

// The SeasonAccountScoping migration must apply AND roll back cleanly on the SQLite
// test provider too (prod runs Npgsql; both paths stay pinned here), and its data
// migration is the contract: OwnerId from the team's coach, one SeasonTeam row per
// season carrying the team's benchmark profile, IsActive→Active / past-end→Completed /
// else Draft, with AssessmentPeriod.SeasonId links surviving untouched.
public class SeasonAccountScopingMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    private const string PreviousMigration = "20260802172012_AddMatchScheduling";

    public SeasonAccountScopingMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SeasonAccountScoping_backfills_and_rolls_back_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await ColumnExistsAsync(db, "Seasons", "OwnerId"));
        Assert.True(await ColumnExistsAsync(db, "Seasons", "Status"));
        Assert.True(await ColumnExistsAsync(db, "AspNetUsers", "CurrentSeasonId"));

        // --- Down: the old single-team shape comes back ---
        await migrator.MigrateAsync(PreviousMigration);
        Assert.True(await ColumnExistsAsync(db, "Seasons", "TeamId"));
        Assert.True(await ColumnExistsAsync(db, "Seasons", "IsActive"));
        Assert.False(await ColumnExistsAsync(db, "Seasons", "OwnerId"));
        Assert.False(await TableExistsAsync(db, "SeasonTeams"));
        Assert.False(await TableExistsAsync(db, "SeasonRosters"));
        Assert.False(await ColumnExistsAsync(db, "AspNetUsers", "CurrentSeasonId"));

        // --- Legacy rows: active, already-over, and upcoming seasons on the seed team ---
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO Seasons (TeamId, Name, StartDate, EndDate, IsActive) VALUES " +
            "(1, 'Legacy Active', '2026-01-01 00:00:00', '2026-12-31 00:00:00', 1), " +
            "(1, 'Legacy Finished', '2024-01-01 00:00:00', '2024-12-31 00:00:00', 0), " +
            "(1, 'Legacy Upcoming', '2099-01-01 00:00:00', '2099-12-31 00:00:00', 0)");
        // Link a real seeded assessment period to the active legacy season.
        await db.Database.ExecuteSqlRawAsync(
            "UPDATE AssessmentPeriods SET SeasonId = " +
            "(SELECT Id FROM Seasons WHERE Name = 'Legacy Active') " +
            $"WHERE Id = {TestAuth.FirstSoccerAssessmentPeriodId}");

        // --- Up: the data migration runs against real legacy rows ---
        await migrator.MigrateAsync();

        var coachId = (string?)await ScalarAsync(db, "SELECT CoachId FROM Teams WHERE Id = 1");
        foreach (var name in new[] { "Legacy Active", "Legacy Finished", "Legacy Upcoming" })
        {
            Assert.Equal(coachId, (string?)await ScalarAsync(db,
                $"SELECT OwnerId FROM Seasons WHERE Name = '{name}'"));
            // Exactly one participation row, for the old team, with the team's profile.
            Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(db,
                "SELECT COUNT(*) FROM SeasonTeams st JOIN Seasons s ON s.Id = st.SeasonId " +
                $"WHERE s.Name = '{name}' AND st.TeamId = 1 AND " +
                "((st.BenchmarkProfileId IS NULL AND (SELECT BenchmarkProfileId FROM Teams WHERE Id = 1) IS NULL) " +
                "OR st.BenchmarkProfileId = (SELECT BenchmarkProfileId FROM Teams WHERE Id = 1))")));
        }
        Assert.Equal(1L, Convert.ToInt64(await ScalarAsync(db,
            "SELECT Status FROM Seasons WHERE Name = 'Legacy Active'")));   // Active
        Assert.Equal(2L, Convert.ToInt64(await ScalarAsync(db,
            "SELECT Status FROM Seasons WHERE Name = 'Legacy Finished'"))); // Completed
        Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(db,
            "SELECT Status FROM Seasons WHERE Name = 'Legacy Upcoming'"))); // Draft

        // The AssessmentPeriod link survived the migration untouched.
        Assert.Equal(
            await ScalarAsync(db, "SELECT Id FROM Seasons WHERE Name = 'Legacy Active'"),
            await ScalarAsync(db,
                $"SELECT SeasonId FROM AssessmentPeriods WHERE Id = {TestAuth.FirstSoccerAssessmentPeriodId}"));

        // Cleanup (unlink first; season delete would SetNull anyway).
        await db.Database.ExecuteSqlRawAsync(
            $"UPDATE AssessmentPeriods SET SeasonId = NULL WHERE Id = {TestAuth.FirstSoccerAssessmentPeriodId}");
        await db.Database.ExecuteSqlRawAsync("DELETE FROM Seasons WHERE Name LIKE 'Legacy %'");
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'");
        return Convert.ToInt64(result) > 0;
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string table)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{table}'");
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
