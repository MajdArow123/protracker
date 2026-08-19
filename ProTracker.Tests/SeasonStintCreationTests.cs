using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 §5d: roster stint creation. Rulings under test:
// - Q3 forward path: a join with exactly one covering season opens a SystemOnJoin
//   stint dated by the CLIENT's local date (S2.2); gap -> silent no-op; ambiguous ->
//   no stint + the coach-facing notice; an existing covering stint -> silent no-op.
// - Isolation: the recorder NEVER throws — an induced failure returns null and the
//   join is unaffected.
// - Q1/Q5 confirmation flow: owner-only (uniform 404, S7 contract; athletes 403 at
//   the role gate); creates CoachConfirmed stints from coach-asserted dates; skips
//   already-covered players; candidates list excludes covered players and carries
//   the earliest-activity HINT.
// - Q2: StintSource is server-stamped only — client JSON is ignored, updates can't
//   change it, and the S6 single path still writes Manual.
public class SeasonStintCreationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonStintCreationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static DateTime U(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    private sealed class Graph
    {
        public HttpClient Client = null!;
        public string OwnerId = "";
        public int TeamId;
    }

    private async Task<Graph> RegisterCoachWithTeamAsync(string tag)
    {
        var g = new Graph { Client = _factory.CreateClient() };
        var email = $"stint.{tag}.{Guid.NewGuid():N}@stint.test";
        (await g.Client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = $"Stint Coach {tag}",
            email,
            password = "Stint123!",
            role = "Coach",
        })).EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        g.OwnerId = (await db.Users.SingleAsync(u => u.Email == email)).Id;
        var team = new Team { Name = $"Stint Team {tag}", SportId = 1, CoachId = g.OwnerId };
        db.Teams.Add(team);
        await db.SaveChangesAsync();
        // Access control resolves coach teams through CoachTeamScope (Phase D), which
        // the API's team-create writes — mirror it for this direct insert.
        db.CoachTeamScopes.Add(new CoachTeamScope { CoachId = g.OwnerId, TeamId = team.Id });
        await db.SaveChangesAsync();
        g.TeamId = team.Id;
        return g;
    }

    private async Task<int> AddSeasonAsync(Graph g, string name, DateTime start, DateTime end)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var season = new Season
        {
            OwnerId = g.OwnerId, Name = name, StartDate = start, EndDate = end,
            Status = SeasonStatus.Active,
        };
        season.SeasonTeams.Add(new SeasonTeam { TeamId = g.TeamId });
        db.Seasons.Add(season);
        await db.SaveChangesAsync();
        return season.Id;
    }

    private async Task<int> CreatePlayerAsync(Graph g, string name, string? localDate)
    {
        var response = await g.Client.PostAsJsonAsync("/api/players", new
        {
            fullName = name, age = 20, height = 180.0, weight = 75.0,
            teamId = g.TeamId, positionId = 1, localDate,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerProfileDto>>())!.Data!.Id;
    }

    private async Task<List<SeasonRoster>> StintsForAsync(int playerId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.SeasonRosters.Where(r => r.PlayerId == playerId).ToListAsync();
    }

    // ── Q3 forward path ──────────────────────────────────────────────────────

    [Fact]
    public async Task Player_create_with_one_covering_season_opens_a_SystemOnJoin_stint_dated_by_the_client_date()
    {
        var g = await RegisterCoachWithTeamAsync("join");
        var seasonId = await AddSeasonAsync(g, "Join Season",
            U(DateTime.UtcNow.Year, 1, 1), U(DateTime.UtcNow.Year, 12, 31));

        // S2.2: the CLIENT's local date wins — send yesterday and expect exactly it.
        var clientDate = UtcToday.AddDays(-1);
        var playerId = await CreatePlayerAsync(g, "Join Alpha", Iso(clientDate));

        var stint = Assert.Single(await StintsForAsync(playerId));
        Assert.Equal(StintSource.SystemOnJoin, stint.Source);
        Assert.Equal(seasonId, stint.SeasonId);
        Assert.Equal(clientDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), stint.JoinedAt);
        Assert.Null(stint.LeftAt);
    }

    [Fact]
    public async Task Gap_join_creates_nothing_and_the_join_succeeds()
    {
        var g = await RegisterCoachWithTeamAsync("gap");
        // A season that does NOT cover today — resolution is a gap.
        await AddSeasonAsync(g, "Old Season", U(2020, 1, 1), U(2020, 6, 30));
        var playerId = await CreatePlayerAsync(g, "Gap Alpha", Iso(UtcToday));
        Assert.Empty(await StintsForAsync(playerId));
    }

    [Fact]
    public async Task Ambiguous_join_creates_nothing_and_the_coach_response_carries_the_notice()
    {
        var g = await RegisterCoachWithTeamAsync("amb");
        var year = DateTime.UtcNow.Year;
        await AddSeasonAsync(g, "Amb 1", U(year, 1, 1), U(year, 12, 31));
        await AddSeasonAsync(g, "Amb 2", U(year - 1, 7, 1), U(year + 1, 6, 30));

        var response = await g.Client.PostAsJsonAsync("/api/players", new
        {
            fullName = "Amb Alpha", age = 20, height = 180.0, weight = 75.0,
            teamId = g.TeamId, positionId = 1, localDate = Iso(UtcToday),
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = (await response.Content.ReadFromJsonAsync<TestApiResponse<PlayerProfileDto>>())!.Data!;
        Assert.NotNull(dto.SeasonNotice);
        Assert.Equal("AmbiguousSeason", dto.SeasonNotice!.Code);
        Assert.Equal(2, dto.SeasonNotice.CandidateSeasonIds.Count);
        Assert.Empty(await StintsForAsync(dto.Id));
    }

    [Fact]
    public async Task Recorder_noops_silently_when_a_covering_stint_already_exists()
    {
        var g = await RegisterCoachWithTeamAsync("dup");
        var seasonId = await AddSeasonAsync(g, "Dup Season",
            U(DateTime.UtcNow.Year, 1, 1), U(DateTime.UtcNow.Year, 12, 31));
        var playerId = await CreatePlayerAsync(g, "Dup Alpha", Iso(UtcToday)); // auto-stint

        // A second join-shaped event for the same player+season must not add a row.
        using var recorderScope = _factory.Services.CreateScope();
        var recorder = recorderScope.ServiceProvider.GetRequiredService<IRosterStintRecorder>();
        var notice = await recorder.RecordJoinAsync(playerId, g.TeamId, Iso(UtcToday));
        Assert.Null(notice);
        var stint = Assert.Single(await StintsForAsync(playerId));
        Assert.Equal(seasonId, stint.SeasonId);
    }

    [Fact]
    public async Task Register_athlete_and_connect_coach_joins_open_stints_too()
    {
        var g = await RegisterCoachWithTeamAsync("flows");
        await AddSeasonAsync(g, "Flows Season",
            U(DateTime.UtcNow.Year, 1, 1), U(DateTime.UtcNow.Year, 12, 31));

        // Join code for both flows.
        var codeResponse = await g.Client.PostAsJsonAsync($"/api/teams/{g.TeamId}/join-code", new { });
        codeResponse.EnsureSuccessStatusCode();
        var code = (await codeResponse.Content.ReadFromJsonAsync<TestApiResponse<TeamJoinCodeDto>>())!.Data!.Code;

        // register-athlete (own client: the endpoint sets athlete cookies).
        var athleteClient = _factory.CreateClient();
        var registerResponse = await athleteClient.PostAsJsonAsync("/api/auth/register-athlete", new
        {
            code,
            email = $"stint.athlete.{Guid.NewGuid():N}@stint.test",
            password = "Stint123!",
            fullName = "Flows Athlete",
            dateOfBirth = "2005-01-01",
            height = 180.0,
            weight = 75.0,
            positionId = 1,
            localDate = Iso(UtcToday),
        });
        Assert.True(registerResponse.IsSuccessStatusCode,
            $"register-athlete failed: {registerResponse.StatusCode} {await registerResponse.Content.ReadAsStringAsync()}");
        var athletePlayerId = (await registerResponse.Content
            .ReadFromJsonAsync<TestApiResponse<RegisterAthleteResponse>>())!.Data!.PlayerId;
        var athleteStint = Assert.Single(await StintsForAsync(athletePlayerId));
        Assert.Equal(StintSource.SystemOnJoin, athleteStint.Source);

        // connect-coach: solo registers, then joins via the code.
        var soloClient = _factory.CreateClient();
        var soloRegister = await soloClient.PostAsJsonAsync("/api/auth/register-solo", new
        {
            email = $"stint.solo.{Guid.NewGuid():N}@stint.test",
            password = "Stint123!",
            fullName = "Flows Solo",
            dateOfBirth = "2000-01-01",
            height = 180.0,
            weight = 75.0,
            sportId = 1,
            positionId = 1,
            skillLevel = "Intermediate",
            trainingFrequency = "FewTimesWeek",
        });
        soloRegister.EnsureSuccessStatusCode();
        var soloPlayerId = (await soloRegister.Content
            .ReadFromJsonAsync<TestApiResponse<RegisterSoloResponse>>())!.Data!.PlayerId;
        var connect = await soloClient.PostAsJsonAsync("/api/solo/connect-coach",
            new { code, localDate = Iso(UtcToday) });
        connect.EnsureSuccessStatusCode();
        var soloStint = Assert.Single(await StintsForAsync(soloPlayerId));
        Assert.Equal(StintSource.SystemOnJoin, soloStint.Source);
    }

    // Isolation contract: the recorder never throws, whatever breaks inside it.
    [Fact]
    public async Task Recorder_swallows_infrastructure_failures_and_returns_null()
    {
        var recorder = new RosterStintRecorder(
            new ExplodingScopeFactory(), NullLogger<RosterStintRecorder>.Instance);
        var notice = await recorder.RecordJoinAsync(1, 1, null);
        Assert.Null(notice);
    }

    private sealed class ExplodingScopeFactory : IServiceScopeFactory
    {
        public IServiceScope CreateScope() => throw new InvalidOperationException("scope exploded");
    }

    // ── Q1/Q5 confirmation flow ──────────────────────────────────────────────

    [Fact]
    public async Task Confirm_creates_CoachConfirmed_stints_skips_covered_and_excludes_them_from_candidates()
    {
        var g = await RegisterCoachWithTeamAsync("confirm");
        var seasonId = await AddSeasonAsync(g, "Confirm Season", U(2020, 1, 1), U(2020, 6, 30));
        // Players created AFTER the historical season's window — no auto-stints (gap).
        var alphaId = await CreatePlayerAsync(g, "Confirm Alpha", Iso(UtcToday));
        var betaId = await CreatePlayerAsync(g, "Confirm Beta", Iso(UtcToday));

        int gapRecordCount;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // A historical gap record inside the window -> feeds the Q8 pointer count.
            db.MatchPerformances.Add(new MatchPerformance
            {
                PlayerId = alphaId, MatchDate = U(2020, 3, 15), Opponent = "Confirm FC", PerformanceRating = 7,
            });
            // Beta already has a stint in the season -> must be skipped, not rewritten.
            db.SeasonRosters.Add(new SeasonRoster
            {
                PlayerId = betaId, SeasonId = seasonId, TeamId = g.TeamId,
                JoinedAt = U(2020, 2, 1), Source = StintSource.Manual,
            });
            await db.SaveChangesAsync();
            gapRecordCount = 1;
        }

        // Candidates: alpha in (with the earliest-activity hint), beta excluded.
        var candidatesResponse = await g.Client.GetAsync($"/api/seasons/{seasonId}/roster/candidates");
        candidatesResponse.EnsureSuccessStatusCode();
        var candidates = (await candidatesResponse.Content
            .ReadFromJsonAsync<TestApiResponse<List<RosterCandidateDto>>>())!.Data!;
        var alphaCandidate = Assert.Single(candidates);
        Assert.Equal(alphaId, alphaCandidate.PlayerId);
        Assert.Equal(U(2020, 3, 15), alphaCandidate.EarliestActivity);

        // Confirm both: alpha created, beta skipped.
        var confirmResponse = await g.Client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/confirm", new
        {
            entries = new[]
            {
                new { playerId = alphaId, joinedAt = "2020-01-15" },
                new { playerId = betaId, joinedAt = "2020-01-15" },
            },
        });
        confirmResponse.EnsureSuccessStatusCode();
        var result = (await confirmResponse.Content
            .ReadFromJsonAsync<TestApiResponse<ConfirmRosterResultDto>>())!.Data!;
        Assert.Equal(1, result.CreatedCount);
        Assert.Equal(1, result.SkippedAlreadyCovered);
        Assert.Equal(gapRecordCount, result.UnstampedInWindow);

        var alphaStint = Assert.Single(await StintsForAsync(alphaId));
        Assert.Equal(StintSource.CoachConfirmed, alphaStint.Source);
        Assert.Equal(U(2020, 1, 15), alphaStint.JoinedAt);
        Assert.Null(alphaStint.LeftAt);
        // Beta's original stint untouched.
        var betaStint = Assert.Single(await StintsForAsync(betaId));
        Assert.Equal(StintSource.Manual, betaStint.Source);
        Assert.Equal(U(2020, 2, 1), betaStint.JoinedAt);

        // A missing date is an explicit 400, never a silently defaulted stint.
        var gammaId = await CreatePlayerAsync(g, "Confirm Gamma", Iso(UtcToday));
        var noDate = await g.Client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/confirm", new
        {
            entries = new[] { new { playerId = gammaId, joinedAt = (string?)null } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, noDate.StatusCode);
        Assert.Empty(await StintsForAsync(gammaId));
    }

    [Fact]
    public async Task Confirm_flow_is_owner_only_athletes_403_and_foreign_coaches_404()
    {
        var g = await RegisterCoachWithTeamAsync("auth");
        var seasonId = await AddSeasonAsync(g, "Auth Season", U(2020, 1, 1), U(2020, 6, 30));

        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await athlete.GetAsync($"/api/seasons/{seasonId}/roster/candidates")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await athlete.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/confirm", new { entries = Array.Empty<object>() })).StatusCode);

        // A coach who is NOT the owner (the assistant shape) gets the uniform 404 —
        // same for a season id that doesn't exist at all (no enumeration).
        var other = await RegisterCoachWithTeamAsync("auth2");
        Assert.Equal(HttpStatusCode.NotFound,
            (await other.Client.GetAsync($"/api/seasons/{seasonId}/roster/candidates")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await other.Client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/confirm", new { entries = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await other.Client.GetAsync("/api/seasons/999999/roster/candidates")).StatusCode);
    }

    // ── Q2: StintSource is server-stamped only ───────────────────────────────

    [Fact]
    public async Task StintSource_cannot_be_set_or_changed_by_clients_and_the_S6_path_stays_Manual()
    {
        var g = await RegisterCoachWithTeamAsync("src");
        var seasonId = await AddSeasonAsync(g, "Src Season", U(2020, 1, 1), U(2020, 6, 30));
        var playerId = await CreatePlayerAsync(g, "Src Alpha", Iso(UtcToday));

        // S6 single-stint create with a smuggled "source" member -> ignored, Manual.
        var create = await g.Client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            playerId, teamId = g.TeamId, joinedAt = "2020-02-01", source = 3,
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var stintId = (await create.Content
            .ReadFromJsonAsync<TestApiResponse<SeasonRosterSaveResultDto>>())!.Data!.Stint.Id;
        var stored = Assert.Single(await StintsForAsync(playerId));
        Assert.Equal(StintSource.Manual, stored.Source);

        // Update with the same smuggled member -> Source unchanged.
        var update = await g.Client.PutAsJsonAsync($"/api/season-roster/{stintId}", new
        {
            playerId, teamId = g.TeamId, joinedAt = "2020-02-10", source = 3,
        });
        update.EnsureSuccessStatusCode();
        stored = Assert.Single(await StintsForAsync(playerId));
        Assert.Equal(StintSource.Manual, stored.Source);
        Assert.Equal(U(2020, 2, 10), stored.JoinedAt);
    }
}

// §5d Q2: the StintSource column — additive, existing rows default Manual (0), clean
// Down on both providers (Postgres proven by the local `dotnet ef database update`;
// SQLite pinned here).
public class SeasonRosterStintSourceMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonRosterStintSourceMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task StintSource_column_applies_and_rolls_back_cleanly_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await ColumnExistsAsync(db, "SeasonRosters", "Source"));

        // The migration immediately BEFORE this one (not "newest excluding it" — that
        // silently no-ops once any later migration exists; bit the S7 test for real).
        var applied = (await db.Database.GetAppliedMigrationsAsync()).OrderBy(m => m).ToList();
        var previous = applied[applied.FindIndex(m => m.EndsWith("_SeasonRosterStintSource")) - 1];
        await migrator.MigrateAsync(previous);
        Assert.False(await ColumnExistsAsync(db, "SeasonRosters", "Source"));

        // A row written under the old schema comes back as Manual (0) after re-apply.
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO SeasonRosters (PlayerId, SeasonId, TeamId, JoinedAt) " +
            "SELECT 1, s.Id, 1, '2020-01-01 00:00:00' FROM Seasons s LIMIT 1");
        var inserted = Convert.ToInt64(await ScalarAsync(db,
            "SELECT COUNT(*) FROM SeasonRosters WHERE JoinedAt = '2020-01-01 00:00:00'"));

        await migrator.MigrateAsync();
        Assert.True(await ColumnExistsAsync(db, "SeasonRosters", "Source"));
        if (inserted > 0)
        {
            Assert.Equal(0L, Convert.ToInt64(await ScalarAsync(db,
                "SELECT Source FROM SeasonRosters WHERE JoinedAt = '2020-01-01 00:00:00' LIMIT 1")));
            await db.Database.ExecuteSqlRawAsync(
                "DELETE FROM SeasonRosters WHERE JoinedAt = '2020-01-01 00:00:00'");
        }
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
