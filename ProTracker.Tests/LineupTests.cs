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

// Tactical layer (Phase 3) — payload shape rules. XI-membership rules are
// service-level and covered by TacticalLineupEndpointTests.
public class LineupTacticalValidatorTests
{
    private static SaveLineupDto Valid() => new()
    {
        Formation = "4-3-3",
        CaptainPlayerId = 1,
        ViceCaptainPlayerId = 2,
        Notes = "Press high.",
        TacticalLabels = new List<string> { "highPress", "counter" },
        Slots = new List<LineupSlotDto>
        {
            new() { SlotKey = "GK", PlayerId = 1, Role = "sweeperKeeper" },
            new() { SlotKey = "D1", PlayerId = 2, Instructions = "Stay back on corners." },
        },
        SetPieces = new List<SetPieceAssignmentDto>
        {
            new() { Type = "penalties", PlayerId = 1 },
            new() { Type = "cornersLeft", PlayerId = 2 },
        },
    };

    [Fact]
    public void Valid_tactical_payload_passes()
    {
        Assert.True(new SaveLineupDtoValidator().Validate(Valid()).IsValid);
    }

    [Fact]
    public void Duplicate_set_piece_types_fail_case_insensitively()
    {
        var dto = Valid();
        dto.SetPieces![1].Type = "Penalties";
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void More_than_ten_set_pieces_fail()
    {
        var dto = Valid();
        dto.SetPieces = Enumerable.Range(1, 11)
            .Select(i => new SetPieceAssignmentDto { Type = $"type{i}", PlayerId = 1 })
            .ToList();
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Bad_tactical_labels_fail()
    {
        var dto = Valid();
        dto.TacticalLabels = new List<string> { "with,comma" };
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto.TacticalLabels = Enumerable.Range(1, 7).Select(i => $"label{i}").ToList();
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto.TacticalLabels = new List<string> { new string('x', 41) };
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Overlong_strings_fail()
    {
        var dto = Valid();
        dto.Notes = new string('n', 2001);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto = Valid();
        dto.Slots[0].Role = new string('r', 41);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto = Valid();
        dto.Slots[0].Instructions = new string('i', 201);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto = Valid();
        dto.SetPieces![0].Type = new string('t', 41);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }
}

// Tactical layer semantics against the live pipeline: round-trip persistence,
// XI-membership enforcement, and the roster-keyed drop contract.
public class TacticalLineupEndpointTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public TacticalLineupEndpointTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static SaveLineupDto TacticalXi() => new()
    {
        Formation = "4-3-3",
        CaptainPlayerId = TestAuth.LiamCarterPlayerId,
        ViceCaptainPlayerId = TestAuth.NoahBennettPlayerId,
        Notes = "Press high after minute 60.",
        TacticalLabels = new List<string> { "highPress", "counter" },
        Slots = new List<LineupSlotDto>
        {
            new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId, Role = "sweeperKeeper" },
            new() { SlotKey = "D1", PlayerId = TestAuth.NoahBennettPlayerId, Instructions = "Stay back on corners." },
            new() { SlotKey = "A1", PlayerId = TestAuth.LucasWardPlayerId },
        },
        SetPieces = new List<SetPieceAssignmentDto>
        {
            new() { Type = "penalties", PlayerId = TestAuth.LucasWardPlayerId },
            new() { Type = "cornersLeft", PlayerId = TestAuth.NoahBennettPlayerId },
        },
    };

    private static string LineupUrl => $"/api/teams/{TestAuth.SoccerTeamId}/lineup";

    private static void AssertTactical(LineupDto dto)
    {
        Assert.Equal(TestAuth.LiamCarterPlayerId, dto.CaptainPlayerId);
        Assert.Equal(TestAuth.NoahBennettPlayerId, dto.ViceCaptainPlayerId);
        Assert.Equal("Press high after minute 60.", dto.Notes);
        Assert.Equal(new[] { "highPress", "counter" }, dto.TacticalLabels);
        Assert.Equal("sweeperKeeper", dto.Slots.Single(s => s.SlotKey == "GK").Role);
        Assert.Equal("Stay back on corners.", dto.Slots.Single(s => s.SlotKey == "D1").Instructions);
        Assert.Equal(2, dto.SetPieces.Count);
        Assert.Equal(TestAuth.LucasWardPlayerId, dto.SetPieces.Single(p => p.Type == "penalties").PlayerId);
    }

    [Fact]
    public async Task Tactical_round_trip_then_write_through_clear()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var put = await coach.PutAsJsonAsync(LineupUrl, TacticalXi());
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        AssertTactical((await put.Content.ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!);

        // A fresh GET (not the upsert echo) proves persistence.
        var got = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        AssertTactical(got);

        // Saving without tactical fields clears them — full write-through, no merge.
        var bare = TacticalXi();
        bare.CaptainPlayerId = null;
        bare.ViceCaptainPlayerId = null;
        bare.Notes = null;
        bare.TacticalLabels = null;
        bare.SetPieces = null;
        bare.Slots.ForEach(s => { s.Role = null; s.Instructions = null; });
        await coach.PutAsJsonAsync(LineupUrl, bare);
        var cleared = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        Assert.Null(cleared.CaptainPlayerId);
        Assert.Null(cleared.Notes);
        Assert.Empty(cleared.TacticalLabels);
        Assert.Empty(cleared.SetPieces);
        Assert.Null(cleared.Slots.Single(s => s.SlotKey == "GK").Role);

        await coach.DeleteAsync(LineupUrl);
    }

    [Fact]
    public async Task Captain_vice_and_takers_must_be_in_the_xi()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var outsider = TestAuth.MarcusBellPlayerId; // on the team, but NOT in this XI

        var dto = TacticalXi();
        dto.CaptainPlayerId = outsider;
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PutAsJsonAsync(LineupUrl, dto)).StatusCode);

        dto = TacticalXi();
        dto.ViceCaptainPlayerId = outsider;
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PutAsJsonAsync(LineupUrl, dto)).StatusCode);

        dto = TacticalXi();
        dto.ViceCaptainPlayerId = dto.CaptainPlayerId;
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PutAsJsonAsync(LineupUrl, dto)).StatusCode);

        dto = TacticalXi();
        dto.SetPieces![0].PlayerId = outsider;
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PutAsJsonAsync(LineupUrl, dto)).StatusCode);

        // Nothing was persisted by the rejected saves.
        var got = await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl);
        Assert.Null(got!.Data);
    }

    [Fact]
    public async Task Deleting_a_player_nulls_captaincy_and_cascades_taker_and_slot()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Temp player created WITHOUT a fitness level — the new honest default.
        var create = await coach.PostAsJsonAsync("/api/players", new PlayerCreateDto
        {
            FullName = "Tactical Temp",
            Age = 18,
            Height = 180,
            Weight = 75,
            TeamId = TestAuth.SoccerTeamId,
            PositionId = 5,
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var temp = (await create.Content.ReadFromJsonAsync<TestApiResponse<PlayerProfileDto>>())!.Data!;
        Assert.Null(temp.FitnessLevel);

        var dto = TacticalXi();
        dto.CaptainPlayerId = temp.Id;
        dto.Slots.Add(new LineupSlotDto { SlotKey = "A2", PlayerId = temp.Id });
        dto.SetPieces!.Add(new SetPieceAssignmentDto { Type = "freeKicks", PlayerId = temp.Id });
        (await coach.PutAsJsonAsync(LineupUrl, dto)).EnsureSuccessStatusCode();

        (await coach.DeleteAsync($"/api/players/{temp.Id}")).EnsureSuccessStatusCode();

        var got = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        Assert.Null(got.CaptainPlayerId);                              // SetNull
        Assert.DoesNotContain(got.SetPieces, p => p.Type == "freeKicks"); // cascade
        Assert.DoesNotContain(got.Slots, s => s.SlotKey == "A2");         // cascade
        // Untouched tactical data survives.
        Assert.Equal(TestAuth.NoahBennettPlayerId, got.ViceCaptainPlayerId);
        Assert.Equal(2, got.SetPieces.Count);
        Assert.Equal(3, got.Slots.Count);

        await coach.DeleteAsync(LineupUrl);
    }

    [Fact]
    public async Task Departed_player_passes_through_on_read_but_blocks_resave()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var create = await coach.PostAsJsonAsync("/api/players", new PlayerCreateDto
        {
            FullName = "Departing Temp",
            Age = 19,
            Height = 178,
            Weight = 72,
            TeamId = TestAuth.SoccerTeamId,
            PositionId = 3,
        });
        var temp = (await create.Content.ReadFromJsonAsync<TestApiResponse<PlayerProfileDto>>())!.Data!;

        var dto = TacticalXi();
        dto.CaptainPlayerId = temp.Id;
        dto.Slots.Add(new LineupSlotDto { SlotKey = "M1", PlayerId = temp.Id });
        (await coach.PutAsJsonAsync(LineupUrl, dto)).EnsureSuccessStatusCode();

        // The player departs the roster but still exists (e.g. a future transfer).
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var row = await db.Players.SingleAsync(p => p.Id == temp.Id);
            row.TeamId = null;
            await db.SaveChangesAsync();
        }

        // Read passes the stored ids through — dropping them is the frontend's
        // roster-keyed hydration contract, mirroring slot behavior.
        var got = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        Assert.Equal(temp.Id, got.CaptainPlayerId);
        Assert.Contains(got.Slots, s => s.PlayerId == temp.Id);

        // But the next save re-validates and refuses to re-persist them.
        Assert.Equal(HttpStatusCode.BadRequest, (await coach.PutAsJsonAsync(LineupUrl, dto)).StatusCode);

        await coach.DeleteAsync(LineupUrl);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Players.Remove(await db.Players.SingleAsync(p => p.Id == temp.Id));
            await db.SaveChangesAsync();
        }
    }
}

// Player tactical attributes (Phase 3): preferred foot + secondary positions.
public class TacticalPlayerEndpointTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public TacticalPlayerEndpointTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static PlayerUpdateDto UpdateFrom(PlayerProfileDto p) => new()
    {
        FullName = p.FullName,
        Age = p.Age,
        Height = p.Height,
        Weight = p.Weight,
        PositionId = p.PositionId,
        FitnessLevel = p.FitnessLevel,
        PreferredFoot = p.PreferredFoot,
        SecondaryPositionIds = p.SecondaryPositionIds,
        JerseyNumber = p.JerseyNumber,
    };

    [Fact]
    public async Task Preferred_foot_and_secondary_positions_lifecycle()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Create: case-insensitive foot, two same-sport secondaries, no fitness.
        var create = await coach.PostAsJsonAsync("/api/players", new PlayerCreateDto
        {
            FullName = "Foot Temp",
            Age = 20,
            Height = 182,
            Weight = 78,
            TeamId = TestAuth.SoccerTeamId,
            PositionId = 5,            // Striker
            PreferredFoot = "left",
            SecondaryPositionIds = new List<int> { 2, 4 }, // Defender, Winger
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var temp = (await create.Content.ReadFromJsonAsync<TestApiResponse<PlayerProfileDto>>())!.Data!;
        Assert.Equal("Left", temp.PreferredFoot);
        Assert.Equal(new List<int> { 2, 4 }, temp.SecondaryPositionIds);
        Assert.Null(temp.FitnessLevel);

        // Fresh GET round-trips the stored values.
        var got = (await coach.GetFromJsonAsync<TestApiResponse<PlayerProfileDto>>(
            $"/api/players/{temp.Id}"))!.Data!;
        Assert.Equal("Left", got.PreferredFoot);
        Assert.Equal(new List<int> { 2, 4 }, got.SecondaryPositionIds);

        // Rejections: cross-sport, duplicate, > 3, contains primary, invalid foot.
        async Task AssertRejected(Action<PlayerUpdateDto> mutate)
        {
            var dto = UpdateFrom(got);
            mutate(dto);
            var response = await coach.PutAsJsonAsync($"/api/players/{temp.Id}", dto);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        await AssertRejected(d => d.SecondaryPositionIds = new List<int> { 6 });          // basketball
        await AssertRejected(d => d.SecondaryPositionIds = new List<int> { 2, 2 });       // duplicate
        await AssertRejected(d => d.SecondaryPositionIds = new List<int> { 1, 2, 3, 4 }); // > 3
        await AssertRejected(d => d.SecondaryPositionIds = new List<int> { 5 });          // primary
        await AssertRejected(d => d.PreferredFoot = "backwards");                          // invalid

        // Write-through clear: foot null + one secondary.
        var update = UpdateFrom(got);
        update.PreferredFoot = null;
        update.SecondaryPositionIds = new List<int> { 3 };
        (await coach.PutAsJsonAsync($"/api/players/{temp.Id}", update)).EnsureSuccessStatusCode();
        var updated = (await coach.GetFromJsonAsync<TestApiResponse<PlayerProfileDto>>(
            $"/api/players/{temp.Id}"))!.Data!;
        Assert.Null(updated.PreferredFoot);
        Assert.Equal(new List<int> { 3 }, updated.SecondaryPositionIds);

        (await coach.DeleteAsync($"/api/players/{temp.Id}")).EnsureSuccessStatusCode();
    }
}

// The AddTacticalLayer migration must apply AND roll back cleanly on the SQLite
// test provider too (prod runs Npgsql; both paths stay pinned here). The down
// path is exercised WITH a NULL-fitness row present to prove the hand-added
// backfill (NULL -> 5) — without it, restoring NOT NULL fails on both providers.
public class TacticalLayerMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    private const string PreviousMigration = "20260715222519_AddLineups";

    public TacticalLayerMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AddTacticalLayer_rolls_back_with_null_fitness_and_reapplies_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        // At head: new columns + table exist, FitnessLevel is nullable.
        Assert.True(await TableExistsAsync(db, "SetPieceAssignments"));
        Assert.True(await ColumnExistsAsync(db, "Players", "PreferredFoot"));
        Assert.True(await ColumnExistsAsync(db, "Players", "SecondaryPositionIds"));
        Assert.True(await ColumnExistsAsync(db, "Lineups", "CaptainPlayerId"));
        Assert.True(await ColumnExistsAsync(db, "Lineups", "ViceCaptainPlayerId"));
        Assert.True(await ColumnExistsAsync(db, "Lineups", "Notes"));
        Assert.True(await ColumnExistsAsync(db, "Lineups", "TacticalLabels"));
        Assert.True(await ColumnExistsAsync(db, "LineupSlots", "Role"));
        Assert.True(await ColumnExistsAsync(db, "LineupSlots", "Instructions"));
        Assert.False(await ColumnNotNullAsync(db, "Players", "FitnessLevel"));

        // A genuinely-NULL fitness row (the new "not recorded" state) must survive
        // the down migration via the backfill, not break it.
        var playerId = Convert.ToInt64(await ScalarAsync(db, "SELECT MIN(Id) FROM Players"));
        await ExecAsync(db, $"UPDATE Players SET FitnessLevel = NULL WHERE Id = {playerId}");

        await migrator.MigrateAsync(PreviousMigration);
        Assert.False(await TableExistsAsync(db, "SetPieceAssignments"));
        Assert.False(await ColumnExistsAsync(db, "Players", "PreferredFoot"));
        Assert.False(await ColumnExistsAsync(db, "Players", "SecondaryPositionIds"));
        Assert.False(await ColumnExistsAsync(db, "Lineups", "CaptainPlayerId"));
        Assert.False(await ColumnExistsAsync(db, "LineupSlots", "Role"));
        Assert.True(await ColumnNotNullAsync(db, "Players", "FitnessLevel"));
        Assert.Equal(5L, Convert.ToInt64(await ScalarAsync(db,
            $"SELECT FitnessLevel FROM Players WHERE Id = {playerId}")));

        await migrator.MigrateAsync();
        Assert.True(await TableExistsAsync(db, "SetPieceAssignments"));
        Assert.True(await ColumnExistsAsync(db, "Players", "PreferredFoot"));
        Assert.False(await ColumnNotNullAsync(db, "Players", "FitnessLevel"));
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string table)
    {
        var value = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{table}'");
        return Convert.ToInt64(value) > 0;
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column)
    {
        var value = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'");
        return Convert.ToInt64(value) > 0;
    }

    private static async Task<bool> ColumnNotNullAsync(ApplicationDbContext db, string table, string column)
    {
        var value = await ScalarAsync(db,
            $"SELECT [notnull] FROM pragma_table_info('{table}') WHERE name = '{column}'");
        return Convert.ToInt64(value) > 0;
    }

    private static async Task<object?> ScalarAsync(ApplicationDbContext db, string sql)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return await cmd.ExecuteScalarAsync();
    }

    private static async Task ExecAsync(ApplicationDbContext db, string sql)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }
}
