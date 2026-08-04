using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProTracker.Data;
using ProTracker.Models;
using ProTracker.Services;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S2: the season resolver is pure lookup and resolves toward null over a
// guess. Every case here seeds its data deliberately (fresh teams/players/seasons/
// roster rows in 2030+ windows) — nothing relies on the demo seed containing them.
// The regression that matters most: player context NEVER routes through
// Player.TeamId ("where are they now"); SeasonRoster is the historical truth.
public class SeasonResolverTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonResolverTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // Captures warnings so the ambiguity contract (null + candidates named) is assertable.
    private sealed class CapturingLogger : ILogger<SeasonResolver>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }

    private sealed class Fixture
    {
        public SeasonResolver Resolver = null!;
        public CapturingLogger Logger = null!;
        public int TeamAlphaId, TeamBetaId;
        public int SeasonAId, SeasonBId, SeasonArchivedId, SeasonOverlap1Id, SeasonOverlap2Id;
        public int PlayerSingleId, PlayerTransferId, PlayerLeftId, PlayerRejoinId, PlayerDoubleId;
    }

    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);

    private async Task<Fixture> ArrangeAsync(IServiceScope scope)
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var f = new Fixture { Logger = new CapturingLogger() };
        f.Resolver = new SeasonResolver(db, f.Logger);

        // Idempotent per test-class database: build the graph once, reuse afterwards.
        var existing = await db.Teams.FirstOrDefaultAsync(t => t.Name == "RSV Alpha");
        var ownerId = (await db.Users.FirstAsync(u => u.Email == TestAuth.SoccerCoachEmail)).Id;

        if (existing == null)
        {
            var alpha = new Team { Name = "RSV Alpha", SportId = 1, CoachId = ownerId };
            var beta = new Team { Name = "RSV Beta", SportId = 1, CoachId = ownerId };
            db.Teams.AddRange(alpha, beta);
            await db.SaveChangesAsync();

            Season Mk(string name, DateTime start, DateTime end, SeasonStatus status, params Team[] teams)
            {
                var s = new Season { OwnerId = ownerId, Name = name, StartDate = start, EndDate = end, Status = status };
                foreach (var t in teams) s.SeasonTeams.Add(new SeasonTeam { TeamId = t.Id });
                db.Seasons.Add(s);
                return s;
            }

            var sA = Mk("RSV 2030 H1", D(2030, 1, 1), D(2030, 6, 30), SeasonStatus.Active, alpha);
            var sB = Mk("RSV 2030 H2", D(2030, 7, 1), D(2030, 12, 31), SeasonStatus.Completed, beta);
            var sArch = Mk("RSV Archived", D(2031, 1, 1), D(2031, 12, 31), SeasonStatus.Archived, alpha);
            var sOv1 = Mk("RSV Overlap 1", D(2032, 1, 1), D(2032, 12, 31), SeasonStatus.Active, alpha);
            var sOv2 = Mk("RSV Overlap 2", D(2032, 6, 1), D(2033, 5, 31), SeasonStatus.Draft, alpha);
            await db.SaveChangesAsync();

            Player MkPlayer(string name, int? teamId)
            {
                var p = new Player { FullName = name, Age = 20, SportId = 1, PositionId = 1, TeamId = teamId };
                db.Players.Add(p);
                return p;
            }

            // d: single covering roster row.
            var pSingle = MkPlayer("RSV Single", alpha.Id);
            // e/f/h: transfer Alpha->Beta with a gap between the rows.
            var pTransfer = MkPlayer("RSV Transfer", beta.Id);
            // g: left in February; Player.TeamId STILL points at Alpha (the trap).
            var pLeft = MkPlayer("RSV Left", alpha.Id);
            // i: rejoined the same season after a gap.
            var pRejoin = MkPlayer("RSV Rejoin", alpha.Id);
            // j (player flavor): rostered into both overlapping seasons at once.
            var pDouble = MkPlayer("RSV Double", alpha.Id);
            await db.SaveChangesAsync();

            db.SeasonRosters.AddRange(
                new SeasonRoster { PlayerId = pSingle.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 10), LeftAt = D(2030, 4, 30) },
                new SeasonRoster { PlayerId = pTransfer.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 3, 31) },
                new SeasonRoster { PlayerId = pTransfer.Id, SeasonId = sB.Id, TeamId = beta.Id, JoinedAt = D(2030, 7, 5), LeftAt = null },
                new SeasonRoster { PlayerId = pLeft.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 2, 28) },
                new SeasonRoster { PlayerId = pRejoin.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 2, 15) },
                new SeasonRoster { PlayerId = pRejoin.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 4, 1), LeftAt = null },
                new SeasonRoster { PlayerId = pDouble.Id, SeasonId = sOv1.Id, TeamId = alpha.Id, JoinedAt = D(2032, 1, 1), LeftAt = null },
                new SeasonRoster { PlayerId = pDouble.Id, SeasonId = sOv2.Id, TeamId = alpha.Id, JoinedAt = D(2032, 6, 1), LeftAt = null });
            await db.SaveChangesAsync();
        }

        f.TeamAlphaId = (await db.Teams.SingleAsync(t => t.Name == "RSV Alpha")).Id;
        f.TeamBetaId = (await db.Teams.SingleAsync(t => t.Name == "RSV Beta")).Id;
        f.SeasonAId = (await db.Seasons.SingleAsync(s => s.Name == "RSV 2030 H1")).Id;
        f.SeasonBId = (await db.Seasons.SingleAsync(s => s.Name == "RSV 2030 H2")).Id;
        f.SeasonArchivedId = (await db.Seasons.SingleAsync(s => s.Name == "RSV Archived")).Id;
        f.SeasonOverlap1Id = (await db.Seasons.SingleAsync(s => s.Name == "RSV Overlap 1")).Id;
        f.SeasonOverlap2Id = (await db.Seasons.SingleAsync(s => s.Name == "RSV Overlap 2")).Id;
        f.PlayerSingleId = (await db.Players.SingleAsync(p => p.FullName == "RSV Single")).Id;
        f.PlayerTransferId = (await db.Players.SingleAsync(p => p.FullName == "RSV Transfer")).Id;
        f.PlayerLeftId = (await db.Players.SingleAsync(p => p.FullName == "RSV Left")).Id;
        f.PlayerRejoinId = (await db.Players.SingleAsync(p => p.FullName == "RSV Rejoin")).Id;
        f.PlayerDoubleId = (await db.Players.SingleAsync(p => p.FullName == "RSV Double")).Id;
        return f;
    }

    // (a) Team context, single matching season → resolves.
    [Fact]
    public async Task Team_single_matching_season_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var season = await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2030, 3, 15));
        Assert.Equal(f.SeasonAId, season?.Id);
    }

    // (b) Team context, date outside all seasons → null.
    [Fact]
    public async Task Team_date_outside_all_seasons_is_null()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        Assert.Null(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2029, 5, 5)));
    }

    // (c) Team context, dates match but the team has no SeasonTeam row → null.
    [Fact]
    public async Task Team_not_in_seasons_participation_is_null_even_when_dates_match()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // Season A covers March 2030 but Beta is not a participant in it.
        Assert.Null(await f.Resolver.ResolveForTeamAsync(f.TeamBetaId, D(2030, 3, 15)));
    }

    // (d) Player context, single roster row, date inside → resolves.
    [Fact]
    public async Task Player_single_roster_row_date_inside_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var season = await f.Resolver.ResolveForPlayerAsync(f.PlayerSingleId, D(2030, 2, 1));
        Assert.Equal(f.SeasonAId, season?.Id);
    }

    // (e) TRANSFER: rows on different teams — each date resolves to its own season.
    [Fact]
    public async Task Player_transfer_resolves_each_side_to_its_own_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var before = await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, D(2030, 2, 15));
        var after = await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, D(2030, 8, 15));
        Assert.Equal(f.SeasonAId, before?.Id);
        Assert.Equal(f.SeasonBId, after?.Id);
    }

    // (f) GAP between LeftAt of row 1 and JoinedAt of row 2 → null.
    [Fact]
    public async Task Player_gap_between_roster_rows_is_null()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        Assert.Null(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, D(2030, 5, 15)));
    }

    // (g) AFTER LEAVING — the regression that matters most: the player left in
    // February, Player.TeamId still points at Alpha, and Alpha has a season covering
    // April. Resolution must be null — proving it did NOT route through Player.TeamId.
    [Fact]
    public async Task Player_after_leaving_is_null_and_never_routes_through_current_team()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // The trap is armed: current team Alpha DOES have a covering season for the date.
        var player = await db.Players.SingleAsync(p => p.Id == f.PlayerLeftId);
        Assert.Equal(f.TeamAlphaId, player.TeamId);
        var viaCurrentTeam = await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2030, 4, 1));
        Assert.Equal(f.SeasonAId, viaCurrentTeam?.Id);

        // …and the player context still says null: no roster row covers the date.
        Assert.Null(await f.Resolver.ResolveForPlayerAsync(f.PlayerLeftId, D(2030, 4, 1)));
    }

    // (h) Open-ended roster row (LeftAt null), date after JoinedAt → resolves.
    [Fact]
    public async Task Player_open_ended_roster_row_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var season = await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, D(2030, 11, 20));
        Assert.Equal(f.SeasonBId, season?.Id);
    }

    // (i) REJOIN: same player, same season, two rows with a gap — each side resolves,
    // the gap returns null.
    [Fact]
    public async Task Player_rejoin_resolves_each_stint_and_nulls_the_gap()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        Assert.Equal(f.SeasonAId, (await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, D(2030, 2, 1)))?.Id);
        Assert.Equal(f.SeasonAId, (await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, D(2030, 5, 1)))?.Id);
        Assert.Null(await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, D(2030, 3, 1)));
    }

    // (j) OVERLAP is a real state: both seasons match → null + warning naming both
    // candidate ids, in team context AND player context. Never silently pick one.
    [Fact]
    public async Task Overlapping_seasons_return_null_and_log_candidates()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);

        Assert.Null(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2032, 8, 1)));
        var teamWarning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains($"team {f.TeamAlphaId}", teamWarning.Message);
        Assert.Contains(f.SeasonOverlap1Id.ToString(), teamWarning.Message);
        Assert.Contains(f.SeasonOverlap2Id.ToString(), teamWarning.Message);

        f.Logger.Entries.Clear();
        Assert.Null(await f.Resolver.ResolveForPlayerAsync(f.PlayerDoubleId, D(2032, 8, 1)));
        var playerWarning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains($"player {f.PlayerDoubleId}", playerWarning.Message);
        Assert.Contains(f.SeasonOverlap1Id.ToString(), playerWarning.Message);
        Assert.Contains(f.SeasonOverlap2Id.ToString(), playerWarning.Message);
    }

    // (k) Archived seasons are never resolved into, even on matching dates.
    [Fact]
    public async Task Archived_season_is_never_resolved()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        Assert.Null(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2031, 6, 1)));
    }

    // (l) Boundary dates are inclusive on both ends.
    [Fact]
    public async Task Boundary_dates_resolve_inclusively()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        Assert.Equal(f.SeasonAId, (await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2030, 1, 1)))?.Id);
        Assert.Equal(f.SeasonAId, (await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2030, 6, 30)))?.Id);
    }

    // Statuses other than Archived are all resolvable — a record can legitimately land
    // in a Completed (or Draft) season; whether it's ALLOWED to is the S3 write
    // guard's call, not the resolver's.
    [Fact]
    public async Task Completed_and_draft_seasons_are_resolvable()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // Season B is Completed; it still resolves in team context.
        Assert.Equal(f.SeasonBId, (await f.Resolver.ResolveForTeamAsync(f.TeamBetaId, D(2030, 9, 1)))?.Id);
        // Overlap 2 is Draft; alone on a date only it covers, it resolves.
        Assert.Equal(f.SeasonOverlap2Id, (await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, D(2033, 2, 1)))?.Id);
    }
}
