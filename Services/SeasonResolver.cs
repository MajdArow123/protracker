using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

// Phase 10 S2: pure season lookup — no writes, no side effects, and deliberately no
// ApplicationUser.CurrentSeasonId fallback (that's a UI write-default consumed by the
// S3 create paths, never a resolver input). Every rule resolves toward null over a
// guess: unassigned is the honest state, and the S7 backfill tool exists precisely so
// a human settles what the resolver refuses to.
//
// (The spec's two "overloads" both take (int, DateTime), which C# can't overload —
// hence the two names.)
public interface ISeasonResolver
{
    // TEAM CONTEXT: the season in which this team participates (SeasonTeam row) whose
    // [StartDate, EndDate] window contains the date, inclusive on both ends.
    Task<Season?> ResolveForTeamAsync(int teamId, DateTime date);

    // PLAYER CONTEXT: resolves via SeasonRoster ONLY — the roster row whose
    // [JoinedAt, LeftAt] (LeftAt null = still on) covers the date. NEVER routes
    // through Player.TeamId: that field is "where are they now", and using it for a
    // historical record is the exact bug SeasonRoster exists to prevent.
    Task<Season?> ResolveForPlayerAsync(int playerId, DateTime date);
}

public class SeasonResolver : ISeasonResolver
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SeasonResolver> _logger;

    public SeasonResolver(ApplicationDbContext context, ILogger<SeasonResolver> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Season?> ResolveForTeamAsync(int teamId, DateTime date)
    {
        var candidates = await _context.Seasons
            .Where(s => s.Status != SeasonStatus.Archived
                && s.StartDate <= date && date <= s.EndDate
                && s.SeasonTeams.Any(st => st.TeamId == teamId))
            .ToListAsync();

        return SingleOrAmbiguous(candidates, $"team {teamId}", date);
    }

    public async Task<Season?> ResolveForPlayerAsync(int playerId, DateTime date)
    {
        // SeasonRoster is the historical truth. A covering roster row is required —
        // no row means the player wasn't rostered anywhere on that date (a gap, a
        // pre-join date, or after leaving), and the answer is null even when
        // Player.TeamId currently points at a team with a covering season.
        var candidates = await _context.SeasonRosters
            .Where(r => r.PlayerId == playerId
                && r.JoinedAt <= date && (r.LeftAt == null || date <= r.LeftAt)
                && r.Season.Status != SeasonStatus.Archived)
            .Select(r => r.Season)
            .ToListAsync();

        // Two roster rows in the SAME season covering one date (e.g. data written
        // around a rejoin) are still unambiguously that season.
        var distinct = candidates.GroupBy(s => s.Id).Select(g => g.First()).ToList();
        return SingleOrAmbiguous(distinct, $"player {playerId}", date);
    }

    // Overlapping seasons are allowed, so >1 match is a real state — return null and
    // name the candidates rather than silently picking one. A wrong season on a row
    // is worse than an unassigned row.
    private Season? SingleOrAmbiguous(List<Season> candidates, string context, DateTime date)
    {
        if (candidates.Count == 0) return null;
        if (candidates.Count == 1) return candidates[0];

        _logger.LogWarning(
            "Season resolution for {Context} on {Date} is ambiguous — candidates: {SeasonIds}. " +
            "Returning null; assign explicitly (S7 backfill).",
            context, date.ToString("yyyy-MM-dd"), string.Join(", ", candidates.Select(s => s.Id).OrderBy(id => id)));
        return null;
    }
}
