using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProTracker.Data;
using ProTracker.Models;
using ProTracker.Services;
using Xunit;

namespace ProTracker.Tests;

// Phase 10 S2/S2.1: the season resolver is pure lookup and resolves toward
// NoCoveringSeason over a guess. Every case here seeds its data deliberately (fresh
// teams/players/seasons/roster rows in 2030+ windows) — nothing relies on the demo seed
// containing them. The regressions that matter most: player context NEVER routes through
// Player.TeamId ("where are they now"; SeasonRoster is the historical truth), and season
// boundaries are DAYS — a caller holding an instant on the final day of a season must
// still resolve into it even though the stored EndDate is midnight.
public class SeasonResolverTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public SeasonResolverTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // Captures warnings so the ambiguity contract (Ambiguous + candidates named) is assertable.
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
        public int SeasonAId, SeasonBId, SeasonArchivedId, SeasonOverlap1Id, SeasonOverlap2Id, SeasonOddHoursId;
        public int PlayerSingleId, PlayerTransferId, PlayerLeftId, PlayerRejoinId, PlayerDoubleId, PlayerLateJoinId, PlayerEarlyJoinId;
    }

    private static DateTime D(int y, int m, int d) => new(y, m, d, 0, 0, 0, DateTimeKind.Utc);
    private static DateOnly Day(int y, int m, int d) => new(y, m, d);

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
            // Stored NON-midnight boundaries (only reachable via direct SQL in prod, but
            // the resolver must stay day-granular against them regardless).
            var sOdd = Mk("RSV Odd Hours",
                new DateTime(2034, 1, 1, 12, 0, 0, DateTimeKind.Utc),
                new DateTime(2034, 6, 30, 9, 0, 0, DateTimeKind.Utc),
                SeasonStatus.Active, alpha);
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
            // o: JoinedAt carries a late-hour time component.
            var pLateJoin = MkPlayer("RSV LateJoin", alpha.Id);
            // p (S6 clamp): stint starts BEFORE its season's StartDate.
            var pEarlyJoin = MkPlayer("RSV EarlyJoin", beta.Id);
            await db.SaveChangesAsync();

            db.SeasonRosters.AddRange(
                new SeasonRoster { PlayerId = pSingle.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 10), LeftAt = D(2030, 4, 30) },
                new SeasonRoster { PlayerId = pTransfer.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 3, 31) },
                new SeasonRoster { PlayerId = pTransfer.Id, SeasonId = sB.Id, TeamId = beta.Id, JoinedAt = D(2030, 7, 5), LeftAt = null },
                new SeasonRoster { PlayerId = pLeft.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 2, 28) },
                new SeasonRoster { PlayerId = pRejoin.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 1, 1), LeftAt = D(2030, 2, 15) },
                new SeasonRoster { PlayerId = pRejoin.Id, SeasonId = sA.Id, TeamId = alpha.Id, JoinedAt = D(2030, 4, 1), LeftAt = null },
                new SeasonRoster { PlayerId = pDouble.Id, SeasonId = sOv1.Id, TeamId = alpha.Id, JoinedAt = D(2032, 1, 1), LeftAt = null },
                new SeasonRoster { PlayerId = pDouble.Id, SeasonId = sOv2.Id, TeamId = alpha.Id, JoinedAt = D(2032, 6, 1), LeftAt = null },
                new SeasonRoster
                {
                    PlayerId = pLateJoin.Id,
                    SeasonId = sA.Id,
                    TeamId = alpha.Id,
                    JoinedAt = new DateTime(2030, 3, 10, 18, 0, 0, DateTimeKind.Utc),
                    LeftAt = null,
                },
                // Joined a month before season B's window opens, never left.
                new SeasonRoster { PlayerId = pEarlyJoin.Id, SeasonId = sB.Id, TeamId = beta.Id, JoinedAt = D(2030, 6, 1), LeftAt = null });
            await db.SaveChangesAsync();
        }

        f.TeamAlphaId = (await db.Teams.SingleAsync(t => t.Name == "RSV Alpha")).Id;
        f.TeamBetaId = (await db.Teams.SingleAsync(t => t.Name == "RSV Beta")).Id;
        f.SeasonAId = (await db.Seasons.SingleAsync(s => s.Name == "RSV 2030 H1")).Id;
        f.SeasonBId = (await db.Seasons.SingleAsync(s => s.Name == "RSV 2030 H2")).Id;
        f.SeasonArchivedId = (await db.Seasons.SingleAsync(s => s.Name == "RSV Archived")).Id;
        f.SeasonOverlap1Id = (await db.Seasons.SingleAsync(s => s.Name == "RSV Overlap 1")).Id;
        f.SeasonOverlap2Id = (await db.Seasons.SingleAsync(s => s.Name == "RSV Overlap 2")).Id;
        f.SeasonOddHoursId = (await db.Seasons.SingleAsync(s => s.Name == "RSV Odd Hours")).Id;
        f.PlayerSingleId = (await db.Players.SingleAsync(p => p.FullName == "RSV Single")).Id;
        f.PlayerTransferId = (await db.Players.SingleAsync(p => p.FullName == "RSV Transfer")).Id;
        f.PlayerLeftId = (await db.Players.SingleAsync(p => p.FullName == "RSV Left")).Id;
        f.PlayerRejoinId = (await db.Players.SingleAsync(p => p.FullName == "RSV Rejoin")).Id;
        f.PlayerDoubleId = (await db.Players.SingleAsync(p => p.FullName == "RSV Double")).Id;
        f.PlayerLateJoinId = (await db.Players.SingleAsync(p => p.FullName == "RSV LateJoin")).Id;
        f.PlayerEarlyJoinId = (await db.Players.SingleAsync(p => p.FullName == "RSV EarlyJoin")).Id;
        return f;
    }

    private static void AssertResolved(SeasonResolution res, int expectedSeasonId)
    {
        Assert.Equal(SeasonResolutionOutcome.Resolved, res.Outcome);
        Assert.Equal(expectedSeasonId, res.SeasonId);
        Assert.Empty(res.CandidateSeasonIds);
    }

    private static void AssertNoCoveringSeason(SeasonResolution res)
    {
        Assert.Equal(SeasonResolutionOutcome.NoCoveringSeason, res.Outcome);
        Assert.Null(res.SeasonId);
        Assert.Empty(res.CandidateSeasonIds);
    }

    // (a) Team context, single matching season → Resolved.
    [Fact]
    public async Task Team_single_matching_season_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2030, 3, 15)), f.SeasonAId);
    }

    // (b) Team context, date outside all seasons → NoCoveringSeason.
    [Fact]
    public async Task Team_date_outside_all_seasons_is_no_covering_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertNoCoveringSeason(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2029, 5, 5)));
    }

    // (c) Team context, dates match but the team has no SeasonTeam row → NoCoveringSeason.
    [Fact]
    public async Task Team_not_in_seasons_participation_is_no_covering_season_even_when_dates_match()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // Season A covers March 2030 but Beta is not a participant in it.
        AssertNoCoveringSeason(await f.Resolver.ResolveForTeamAsync(f.TeamBetaId, Day(2030, 3, 15)));
    }

    // (d) Player context, single roster row, date inside → Resolved.
    [Fact]
    public async Task Player_single_roster_row_date_inside_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerSingleId, Day(2030, 2, 1)), f.SeasonAId);
    }

    // (e) TRANSFER: rows on different teams — each date resolves to its own season.
    [Fact]
    public async Task Player_transfer_resolves_each_side_to_its_own_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2030, 2, 15)), f.SeasonAId);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2030, 8, 15)), f.SeasonBId);
    }

    // (f) GAP between LeftAt of row 1 and JoinedAt of row 2 → NoCoveringSeason.
    [Fact]
    public async Task Player_gap_between_roster_rows_is_no_covering_season()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2030, 5, 15)));
    }

    // (g) AFTER LEAVING — the regression that matters most: the player left in
    // February, Player.TeamId still points at Alpha, and Alpha has a season covering
    // April. Resolution must be NoCoveringSeason — proving it did NOT route through
    // Player.TeamId.
    [Fact]
    public async Task Player_after_leaving_is_no_covering_season_and_never_routes_through_current_team()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // The trap is armed: current team Alpha DOES have a covering season for the date.
        var player = await db.Players.SingleAsync(p => p.Id == f.PlayerLeftId);
        Assert.Equal(f.TeamAlphaId, player.TeamId);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2030, 4, 1)), f.SeasonAId);

        // …and the player context still says NoCoveringSeason: no roster row covers the date.
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerLeftId, Day(2030, 4, 1)));
    }

    // (h) Open-ended roster row (LeftAt null), date after JoinedAt → Resolved.
    [Fact]
    public async Task Player_open_ended_roster_row_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2030, 11, 20)), f.SeasonBId);
    }

    // (i) REJOIN: same player, same season, two rows with a gap — each side resolves,
    // the gap returns NoCoveringSeason.
    [Fact]
    public async Task Player_rejoin_resolves_each_stint_and_no_covering_season_in_the_gap()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, Day(2030, 2, 1)), f.SeasonAId);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, Day(2030, 5, 1)), f.SeasonAId);
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerRejoinId, Day(2030, 3, 1)));
    }

    // (j) OVERLAP is a real state: both seasons match → Ambiguous with the sorted
    // candidate ids populated + warning naming both, in team context AND player
    // context. Never silently pick one.
    [Fact]
    public async Task Overlapping_seasons_return_ambiguous_with_candidates_and_log()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var expectedCandidates = new[] { f.SeasonOverlap1Id, f.SeasonOverlap2Id }.OrderBy(id => id).ToList();

        var teamRes = await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2032, 8, 1));
        Assert.Equal(SeasonResolutionOutcome.Ambiguous, teamRes.Outcome);
        Assert.Null(teamRes.SeasonId);
        Assert.Equal(expectedCandidates, teamRes.CandidateSeasonIds);
        var teamWarning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains($"team {f.TeamAlphaId}", teamWarning.Message);
        Assert.Contains(f.SeasonOverlap1Id.ToString(), teamWarning.Message);
        Assert.Contains(f.SeasonOverlap2Id.ToString(), teamWarning.Message);

        f.Logger.Entries.Clear();
        var playerRes = await f.Resolver.ResolveForPlayerAsync(f.PlayerDoubleId, Day(2032, 8, 1));
        Assert.Equal(SeasonResolutionOutcome.Ambiguous, playerRes.Outcome);
        Assert.Null(playerRes.SeasonId);
        Assert.Equal(expectedCandidates, playerRes.CandidateSeasonIds);
        var playerWarning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains($"player {f.PlayerDoubleId}", playerWarning.Message);
        Assert.Contains(f.SeasonOverlap1Id.ToString(), playerWarning.Message);
        Assert.Contains(f.SeasonOverlap2Id.ToString(), playerWarning.Message);
    }

    // (k) Archived seasons are never resolved into, even on matching dates — and the
    // outcome is NoCoveringSeason (they are filtered BEFORE ambiguity counting).
    [Fact]
    public async Task Archived_season_is_never_resolved()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertNoCoveringSeason(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2031, 6, 1)));
    }

    // (l) Boundary dates are inclusive on both ends.
    [Fact]
    public async Task Boundary_dates_resolve_inclusively()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2030, 1, 1)), f.SeasonAId);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2030, 6, 30)), f.SeasonAId);
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
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamBetaId, Day(2030, 9, 1)), f.SeasonBId);
        // Overlap 2 is Draft; alone on a date only it covers, it resolves.
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2033, 2, 1)), f.SeasonOverlap2Id);
    }

    // (m) THE BUG ruled out: a caller holding an instant at 14:00 on the season's final
    // day converts to DateOnly and resolves — the stored midnight EndDate can never
    // exclude the final day again.
    [Fact]
    public async Task End_date_day_at_afternoon_hour_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var instant = new DateTime(2030, 6, 30, 14, 0, 0, DateTimeKind.Utc);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, DateOnly.FromDateTime(instant)), f.SeasonAId);
    }

    // (n) Same at the other boundary: 23:59 on the StartDate day resolves.
    [Fact]
    public async Task Start_date_day_at_late_hour_resolves()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        var instant = new DateTime(2030, 1, 1, 23, 59, 0, DateTimeKind.Utc);
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, DateOnly.FromDateTime(instant)), f.SeasonAId);
    }

    // (o) DOCUMENTED BEHAVIOUR, asserted explicitly: membership is day-granular, and a
    // join day counts WHOLLY — JoinedAt stored at 18:00 on March 10 still covers a
    // record from earlier that same day (the DateOnly for March 10 represents every
    // hour of it).
    [Fact]
    public async Task Join_day_counts_wholly_even_when_joined_at_a_late_hour()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerLateJoinId, Day(2030, 3, 10)), f.SeasonAId);
        // And the day before the join is honestly outside.
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerLateJoinId, Day(2030, 3, 9)));
    }

    // Storage-side variant of (m)/(n): season boundaries stored with NON-midnight time
    // components (only possible via direct SQL, but the resolver must stay day-granular
    // against them) — both boundary days still resolve.
    [Fact]
    public async Task Stored_non_midnight_boundaries_still_resolve_day_granularly()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // StartDate stored 12:00 → Jan 1 is still fully inside.
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2034, 1, 1)), f.SeasonOddHoursId);
        // EndDate stored 09:00 → Jun 30 is still fully inside.
        AssertResolved(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2034, 6, 30)), f.SeasonOddHoursId);
        // And the day after the end is outside.
        AssertNoCoveringSeason(await f.Resolver.ResolveForTeamAsync(f.TeamAlphaId, Day(2034, 7, 1)));
    }

    // (S6 CLAMP, regression 1): an open-ended stint (LeftAt null — the UI default)
    // must NOT resolve its season for dates after the season's own EndDate. Before the
    // clamp this returned Resolved(SeasonB) — the asymmetry with the team path was
    // invisible only because SeasonRosters had zero production rows.
    [Fact]
    public async Task Player_open_ended_stint_does_not_resolve_past_the_seasons_end()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // pTransfer's season-B stint is open-ended; season B ended 2030-12-31.
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2031, 1, 15)));
        // Control: the same stint still resolves inside the window.
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerTransferId, Day(2030, 12, 31)), f.SeasonBId);
    }

    // (S6 CLAMP, regression 2): a stint starting before the season's StartDate must not
    // resolve dates before the window opens — the stint covers them, the season doesn't.
    [Fact]
    public async Task Player_stint_starting_before_the_season_does_not_resolve_before_season_start()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        // Joined 2030-06-01; season B opens 2030-07-01. June is outside the season.
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(f.PlayerEarlyJoinId, Day(2030, 6, 15)));
        // Control: inside the season window the same stint resolves.
        AssertResolved(await f.Resolver.ResolveForPlayerAsync(f.PlayerEarlyJoinId, Day(2030, 8, 15)), f.SeasonBId);
    }

    // GUARD: a nonexistent team id (e.g. a playerId passed by mistake — both methods
    // take bare ints) → NoCoveringSeason + a warning naming the method and the id,
    // never a plausible wrong answer.
    [Fact]
    public async Task Nonexistent_team_id_is_no_covering_season_with_warning()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertNoCoveringSeason(await f.Resolver.ResolveForTeamAsync(987_654, Day(2030, 3, 15)));
        var warning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("ResolveForTeamAsync", warning.Message);
        Assert.Contains("987654", warning.Message);
    }

    // GUARD: same contract for a nonexistent player id.
    [Fact]
    public async Task Nonexistent_player_id_is_no_covering_season_with_warning()
    {
        using var scope = _factory.Services.CreateScope();
        var f = await ArrangeAsync(scope);
        AssertNoCoveringSeason(await f.Resolver.ResolveForPlayerAsync(987_654, Day(2030, 3, 15)));
        var warning = Assert.Single(f.Logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("ResolveForPlayerAsync", warning.Message);
        Assert.Contains("987654", warning.Message);
    }
}
