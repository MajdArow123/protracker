using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Validation;

namespace ProTracker.Tests;

// Saved lineups (Phase 2): validator rules, transactional-upsert semantics,
// CanManageTeam authz, and the per-team batch evidence-scores endpoint.
public class LineupValidatorTests
{
    private static SaveLineupDto Valid() => new()
    {
        Formation = "4-3-3",
        Slots = new List<LineupSlotDto>
        {
            new() { SlotKey = "GK", PlayerId = 1 },
            new() { SlotKey = "D1", PlayerId = 2 },
        },
    };

    [Fact]
    public void Valid_payload_passes()
    {
        Assert.True(new SaveLineupDtoValidator().Validate(Valid()).IsValid);
    }

    [Fact]
    public void Empty_or_oversized_formation_fails()
    {
        var dto = Valid();
        dto.Formation = "";
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto.Formation = new string('4', 17);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Duplicate_slot_keys_fail()
    {
        var dto = Valid();
        dto.Slots[1].SlotKey = "GK";
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Duplicate_players_fail()
    {
        var dto = Valid();
        dto.Slots[1].PlayerId = 1;
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void More_than_eleven_slots_fail()
    {
        var dto = Valid();
        dto.Slots = Enumerable.Range(1, 12)
            .Select(i => new LineupSlotDto { SlotKey = $"S{i}", PlayerId = i })
            .ToList();
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }
}

public class LineupEndpointTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public LineupEndpointTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static SaveLineupDto DefaultXi(string formation = "4-3-3") => new()
    {
        Formation = formation,
        Slots = new List<LineupSlotDto>
        {
            new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId },
            new() { SlotKey = "D1", PlayerId = TestAuth.NoahBennettPlayerId },
            new() { SlotKey = "A1", PlayerId = TestAuth.LucasWardPlayerId },
        },
    };

    [Fact]
    public async Task Lineup_full_upsert_lifecycle_default_and_match()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // 1. Nothing saved yet → 200 with null data (frontend falls back to suggested).
        var initial = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.True(initial!.Success);
        Assert.Null(initial.Data);

        // 2. Save the default XI.
        var putResponse = await coach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", DefaultXi());
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        var saved = (await putResponse.Content.ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Null(saved.MatchResultId);
        Assert.Equal("4-3-3", saved.Formation);
        Assert.Equal(3, saved.Slots.Count);

        // 3. Re-save with changes → same row mutated (upsert), never a duplicate.
        var second = await coach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", DefaultXi("4-4-2"));
        var resaved = (await second.Content.ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal(saved.Id, resaved.Id);
        Assert.Equal("4-4-2", resaved.Formation);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(1, await db.Lineups.CountAsync(
                l => l.TeamId == TestAuth.SoccerTeamId && l.MatchResultId == null));
        }

        // 4. A match lineup coexists with the default under its own key.
        var matchResponse = await coach.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/matches", new
        {
            opponentName = "Lineup Test FC",
            matchDate = DateTime.UtcNow.AddDays(-1),
            homeScore = 2,
            awayScore = 1,
            isHome = true,
        });
        matchResponse.EnsureSuccessStatusCode();
        var matchId = (await matchResponse.Content.ReadFromJsonAsync<TestApiResponse<MatchProbeDto>>())!.Data!.Id;

        var matchXi = DefaultXi("3-5-2");
        matchXi.MatchResultId = matchId;
        var matchPut = await coach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", matchXi);
        Assert.Equal(HttpStatusCode.OK, matchPut.StatusCode);

        var forMatch = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup?matchId={matchId}");
        Assert.Equal("3-5-2", forMatch!.Data!.Formation);
        var stillDefault = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Equal("4-4-2", stillDefault!.Data!.Formation);

        // 5. Deleting the default resets it; the match lineup survives.
        var delete = await coach.DeleteAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        var afterDelete = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Null(afterDelete!.Data);
        var matchSurvives = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup?matchId={matchId}");
        Assert.NotNull(matchSurvives!.Data);

        // Cleanup so other fixtures see pristine seed data.
        await coach.DeleteAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup?matchId={matchId}");
        await coach.DeleteAsync($"/api/matches/{matchId}");
    }

    [Fact]
    public async Task Lineup_rejects_player_from_another_team()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var dto = DefaultXi();
        dto.Slots[0].PlayerId = TestAuth.MarcusBellPlayerId; // basketball player
        var response = await coach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", dto);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Lineup_rejects_match_from_another_team()
    {
        var basketballCoach = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        var matchResponse = await basketballCoach.PostAsJsonAsync($"/api/teams/{TestAuth.BasketballTeamId}/matches", new
        {
            opponentName = "Cross Team Probe",
            matchDate = DateTime.UtcNow.AddDays(-1),
            homeScore = 80,
            awayScore = 70,
            isHome = true,
        });
        matchResponse.EnsureSuccessStatusCode();
        var foreignMatchId = (await matchResponse.Content.ReadFromJsonAsync<TestApiResponse<MatchProbeDto>>())!.Data!.Id;

        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var dto = DefaultXi();
        dto.MatchResultId = foreignMatchId;
        var response = await coach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", dto);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        await basketballCoach.DeleteAsync($"/api/matches/{foreignMatchId}");
    }

    [Fact]
    public async Task Lineup_denied_for_other_coach()
    {
        var basketballCoach = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        var get = await basketballCoach.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Equal(HttpStatusCode.Forbidden, get.StatusCode);

        var put = await basketballCoach.PutAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup", DefaultXi());
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);

        var delete = await basketballCoach.DeleteAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
    }

    [Fact]
    public async Task Lineup_denied_for_athlete()
    {
        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        var get = await athlete.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}/lineup");
        Assert.Equal(HttpStatusCode.Forbidden, get.StatusCode); // [Authorize(Roles = "Coach,Admin")]
    }

    private class MatchProbeDto
    {
        public int Id { get; set; }
    }
}

public class TeamEvidenceScoresBatchTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public TeamEvidenceScoresBatchTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Batch_returns_every_roster_player_with_current_scores()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Give one player a real evidence score so the batch has content to prove.
        var test = await coach.PostAsJsonAsync("/api/objective-tests", new
        {
            playerId = TestAuth.LiamCarterPlayerId,
            metricDefinitionId = 1, // soccer Speed
            value = 4.2,
        });
        test.EnsureSuccessStatusCode();
        (await coach.PostAsync($"/api/evidence-scores/calculate/{TestAuth.LiamCarterPlayerId}", null))
            .EnsureSuccessStatusCode();

        var batch = await coach.GetFromJsonAsync<TestApiResponse<List<PlayerEvidenceScoresDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/evidence-scores");
        Assert.True(batch!.Success);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var rosterCount = await db.Players.CountAsync(p => p.TeamId == TestAuth.SoccerTeamId);

        // Every roster player appears, even with zero evidence.
        Assert.Equal(rosterCount, batch.Data!.Count);
        var liam = batch.Data.Single(p => p.PlayerId == TestAuth.LiamCarterPlayerId);
        Assert.Contains(liam.Scores, s => s.MetricName == "Speed" && s.FinalScore > 0);
        // Only current rows (AssessmentId == null) ever appear in the batch.
        Assert.All(batch.Data.SelectMany(p => p.Scores), s => Assert.Null(s.AssessmentId));
    }

    [Fact]
    public async Task Batch_denied_for_other_coach()
    {
        var basketballCoach = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        var response = await basketballCoach.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}/evidence-scores");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

// The AddLineups migration must apply AND roll back cleanly on the SQLite test
// provider too (prod runs Npgsql; both paths stay pinned here).
public class LineupMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    private const string PreviousMigration = "20260711111447_AddConfidenceTracking";

    public LineupMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AddLineups_rolls_back_and_reapplies_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await TableExistsAsync(db, "Lineups"));
        Assert.True(await TableExistsAsync(db, "LineupSlots"));

        await migrator.MigrateAsync(PreviousMigration);
        Assert.False(await TableExistsAsync(db, "Lineups"));
        Assert.False(await TableExistsAsync(db, "LineupSlots"));

        await migrator.MigrateAsync();
        Assert.True(await TableExistsAsync(db, "Lineups"));
        Assert.True(await TableExistsAsync(db, "LineupSlots"));
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string table)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=$name";
        var p = cmd.CreateParameter();
        p.ParameterName = "$name";
        p.Value = table;
        cmd.Parameters.Add(p);
        return Convert.ToInt64(await cmd.ExecuteScalarAsync()) > 0;
    }
}
