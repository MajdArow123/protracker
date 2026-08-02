using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Validation;

namespace ProTracker.Tests;

// Phase 7a — scheduled-vs-played matches (the fixtures honesty gate, blueprint
// §5b #1). A Scheduled row is an upcoming fixture with NO score: the DTO masks
// every score/outcome field to null, so a future match can never render as a
// 0-0 Draw. Ratings are evidence of play — a Scheduled match rejects them, and
// a Played match with ratings refuses to revert to Scheduled.

public class MatchSchedulingValidatorTests
{
    private static CreateMatchResultDto Valid() => new()
    {
        OpponentName = "Test FC",
        MatchDate = DateTime.UtcNow,
    };

    [Fact]
    public void Valid_dto_passes_and_status_defaults_to_played()
    {
        var dto = Valid();
        Assert.True(new CreateMatchResultDtoValidator().Validate(dto).IsValid);
        Assert.Equal(MatchStatus.Played, dto.Status);
    }

    [Fact]
    public void Out_of_range_status_fails()
    {
        var dto = Valid();
        dto.Status = (MatchStatus)7;
        Assert.False(new CreateMatchResultDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Coach_entered_plan_fields_are_length_capped()
    {
        var v = new CreateMatchResultDtoValidator();

        var longFormation = Valid();
        longFormation.OpponentFormation = new string('4', 21);
        Assert.False(v.Validate(longFormation).IsValid);

        var longScouting = Valid();
        longScouting.ScoutingNotes = new string('s', 2001);
        Assert.False(v.Validate(longScouting).IsValid);

        var ok = Valid();
        ok.OpponentFormation = "4-3-3";
        ok.ScoutingNotes = "Presses high, weak left flank.";
        Assert.True(v.Validate(ok).IsValid);
    }

    [Fact]
    public void Negative_scores_and_empty_opponent_fail()
    {
        var v = new CreateMatchResultDtoValidator();

        var negative = Valid();
        negative.HomeScore = -1;
        Assert.False(v.Validate(negative).IsValid);

        var noOpponent = Valid();
        noOpponent.OpponentName = " ";
        Assert.False(v.Validate(noOpponent).IsValid);
    }
}

public class MatchSchedulingTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public MatchSchedulingTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private class MatchDtoProbe
    {
        public int Id { get; set; }
        public string Status { get; set; } = "";
        public int? HomeScore { get; set; }
        public int? AwayScore { get; set; }
        public int? OurScore { get; set; }
        public int? OpponentScore { get; set; }
        public string? Result { get; set; }
        public string? ScoreDisplay { get; set; }
        public string? SetScores { get; set; }
        public string? OpponentFormation { get; set; }
        public string? ScoutingNotes { get; set; }
    }

    private static async Task<MatchDtoProbe> CreateAsync(HttpClient coach, object body)
    {
        var response = await coach.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/matches", body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<MatchDtoProbe>>())!.Data!;
    }

    [Fact]
    public async Task Scheduled_create_masks_every_score_field_never_a_draw()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Scores sent deliberately — a Scheduled fixture must ignore them.
        var created = await CreateAsync(coach, new
        {
            opponentName = "Fixture Honesty FC",
            matchDate = DateTime.UtcNow.AddDays(7),
            status = "Scheduled",
            homeScore = 3,
            awayScore = 2,
            isHome = true,
            setScores = "25-20",
            opponentFormation = "4-4-2",
            scoutingNotes = "Strong on set pieces.",
        });

        Assert.Equal("Scheduled", created.Status);
        Assert.Null(created.Result);        // NEVER a Draw
        Assert.Null(created.HomeScore);
        Assert.Null(created.AwayScore);
        Assert.Null(created.OurScore);
        Assert.Null(created.OpponentScore);
        Assert.Null(created.ScoreDisplay);
        Assert.Null(created.SetScores);
        // Coach-entered plan fields round-trip.
        Assert.Equal("4-4-2", created.OpponentFormation);
        Assert.Equal("Strong on set pieces.", created.ScoutingNotes);

        // The list endpoint masks identically (same ToDto path).
        var list = (await coach.GetFromJsonAsync<TestApiResponse<List<MatchDtoProbe>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/matches"))!.Data!;
        var listed = list.Single(m => m.Id == created.Id);
        Assert.Equal("Scheduled", listed.Status);
        Assert.Null(listed.Result);

        // Record the result — the natural Scheduled → Played transition.
        var recorded = await coach.PutAsJsonAsync($"/api/matches/{created.Id}", new
        {
            opponentName = "Fixture Honesty FC",
            matchDate = DateTime.UtcNow.AddDays(7),
            status = "Played",
            homeScore = 2,
            awayScore = 1,
            isHome = true,
        });
        recorded.EnsureSuccessStatusCode();
        var played = (await recorded.Content.ReadFromJsonAsync<TestApiResponse<MatchDtoProbe>>())!.Data!;
        Assert.Equal("Played", played.Status);
        Assert.Equal("Win", played.Result);
        Assert.Equal(2, played.OurScore);
        Assert.Equal("2 - 1", played.ScoreDisplay);

        (await coach.DeleteAsync($"/api/matches/{created.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Rating_a_scheduled_fixture_is_400()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var fixture = await CreateAsync(coach, new
        {
            opponentName = "Unplayed FC",
            matchDate = DateTime.UtcNow.AddDays(3),
            status = "Scheduled",
            isHome = true,
        });

        var rate = await coach.PostAsJsonAsync($"/api/matches/{fixture.Id}/ratings", new
        {
            ratings = new[] { new { playerId = TestAuth.LucasWardPlayerId, rating = 8.0 } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, rate.StatusCode);

        // The guard also kept the evidence auto-import from running.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(0, await db.MatchStatEntries.CountAsync(e => e.MatchResultId == fixture.Id));
            Assert.Equal(0, await db.PlayerMatchRatings.CountAsync(r => r.MatchResultId == fixture.Id));
        }

        (await coach.DeleteAsync($"/api/matches/{fixture.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Reverting_a_rated_played_match_to_scheduled_is_409()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var match = await CreateAsync(coach, new
        {
            opponentName = "Revert Guard FC",
            matchDate = DateTime.UtcNow.AddDays(-1),
            homeScore = 1,
            awayScore = 0,
            isHome = true,
        });

        var rate = await coach.PostAsJsonAsync($"/api/matches/{match.Id}/ratings", new
        {
            ratings = new[] { new { playerId = TestAuth.LucasWardPlayerId, rating = 7.5 } },
        });
        rate.EnsureSuccessStatusCode();

        object revertBody = new
        {
            opponentName = "Revert Guard FC",
            matchDate = DateTime.UtcNow.AddDays(-1),
            status = "Scheduled",
            isHome = true,
        };
        var revert = await coach.PutAsJsonAsync($"/api/matches/{match.Id}", revertBody);
        Assert.Equal(HttpStatusCode.Conflict, revert.StatusCode);

        // With the ratings removed the revert is allowed — and the score is gone.
        (await coach.PostAsJsonAsync($"/api/matches/{match.Id}/ratings",
            new { ratings = Array.Empty<object>() })).EnsureSuccessStatusCode();
        var revertOk = await coach.PutAsJsonAsync($"/api/matches/{match.Id}", revertBody);
        revertOk.EnsureSuccessStatusCode();
        var reverted = (await revertOk.Content.ReadFromJsonAsync<TestApiResponse<MatchDtoProbe>>())!.Data!;
        Assert.Equal("Scheduled", reverted.Status);
        Assert.Null(reverted.Result);
        Assert.Null(reverted.ScoreDisplay);

        (await coach.DeleteAsync($"/api/matches/{match.Id}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Pre_phase7_payload_without_status_still_records_a_played_match()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // No `status` field at all — the exact payload existing clients send.
        var created = await CreateAsync(coach, new
        {
            opponentName = "Legacy Client FC",
            matchDate = DateTime.UtcNow.AddDays(-2),
            homeScore = 0,
            awayScore = 0,
            isHome = true,
        });
        Assert.Equal("Played", created.Status);
        Assert.Equal("Draw", created.Result); // a REAL played 0-0 is honestly a Draw
        Assert.Equal("0 - 0", created.ScoreDisplay);

        (await coach.DeleteAsync($"/api/matches/{created.Id}")).EnsureSuccessStatusCode();
    }
}

// The AddMatchScheduling migration must apply AND roll back cleanly on the
// SQLite test provider too (prod runs Npgsql; both paths stay pinned here).
// Pre-existing rows come back as Status=0 (Played) — truthful for every row
// that existed before the scheduled concept did.
public class MatchSchedulingMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    private const string PreviousMigration = "20260720184604_AddLineupWorkflow";

    public MatchSchedulingMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AddMatchScheduling_rolls_back_and_reapplies_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        foreach (var column in new[] { "Status", "OpponentFormation", "ScoutingNotes" })
            Assert.True(await ColumnExistsAsync(db, "MatchResults", column));

        await migrator.MigrateAsync(PreviousMigration);
        foreach (var column in new[] { "Status", "OpponentFormation", "ScoutingNotes" })
            Assert.False(await ColumnExistsAsync(db, "MatchResults", column));

        // A match saved before the migration must come back as Played (0),
        // never Scheduled — its score is real recorded data.
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO MatchResults (TeamId, OpponentName, MatchDate, HomeScore, AwayScore, IsHome, ScoreFormat) " +
            "VALUES (1, 'PreMigration FC', '2026-01-01 00:00:00', 2, 1, 1, 0)");

        await migrator.MigrateAsync();
        var status = await ScalarAsync(db,
            "SELECT Status FROM MatchResults WHERE OpponentName = 'PreMigration FC' LIMIT 1");
        Assert.Equal(0L, Convert.ToInt64(status)); // Played

        await db.Database.ExecuteSqlRawAsync(
            "DELETE FROM MatchResults WHERE OpponentName = 'PreMigration FC'");
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'");
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
