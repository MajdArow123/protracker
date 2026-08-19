using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

// Phase 10 §5h Q1/Q2: THE population semantics for season-scoped team surfaces —
// centralized here so the report (and later §5f) can never drift apart.
// - Arm 1 (the roster): players with a SeasonRoster stint for (SeasonId = X,
//   TeamId = T). Stints are season-KEYED — a direct query, no window math.
// - Arm 2 (the point-in-time edge): CURRENT team members with season-X-stamped
//   player-context records AND no SeasonRoster row for season X on ANY team. The
//   narrowing is load-bearing: without it, a post-season transferee's old-team
//   stamps would leak into the new team's report and double-count across both.
//   This is the single pinned exception to the "no Player.TeamId in season-filtered
//   report logic" rule.
// - Record inclusion is STAMPS, full stop (Q3): no re-windowing by stint dates —
//   the resolver applied the window at stamp time, and the report must agree with
//   every other stamp-filtered surface.
public interface ISeasonPopulationService
{
    Task<SeasonTeamPopulation> GetTeamPopulationAsync(int teamId, int seasonId);

    // Q4's N: the team's unstamped team-context records (matches + both session
    // kinds) + unstamped player-context records of the (narrowed) population.
    Task<int> CountUnassignedAsync(int teamId, IReadOnlyCollection<int> populationPlayerIds);
}

public class SeasonTeamPopulation
{
    // Union of both arms, distinct, Position loaded — the report's player identity
    // source (never team.Players, which throws for departed players).
    public List<Player> Players { get; init; } = new();
    // Arm 1 only — "stints decide the roster listing".
    public List<SeasonRoster> RosterStints { get; init; } = new();
}

public class SeasonPopulationService : ISeasonPopulationService
{
    private readonly ApplicationDbContext _context;

    public SeasonPopulationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SeasonTeamPopulation> GetTeamPopulationAsync(int teamId, int seasonId)
    {
        // Arm 1: the stint roster, season-keyed.
        var stints = await _context.SeasonRosters
            .Include(r => r.Player).ThenInclude(p => p.Position)
            .Include(r => r.Position)
            .Where(r => r.SeasonId == seasonId && r.TeamId == teamId)
            .OrderBy(r => r.Player.FullName).ThenBy(r => r.JoinedAt)
            .ToListAsync();
        var rosterPlayerIds = stints.Select(s => s.PlayerId).Distinct().ToHashSet();

        // Arm 2: current members with season-X stamps and NO season-X stint anywhere.
        var currentMemberIds = await _context.Players
            .Where(p => p.TeamId == teamId)
            .Select(p => p.Id)
            .ToListAsync();
        var anyStintThisSeason = await _context.SeasonRosters
            .Where(r => r.SeasonId == seasonId && currentMemberIds.Contains(r.PlayerId))
            .Select(r => r.PlayerId)
            .Distinct()
            .ToListAsync();
        var arm2Candidates = currentMemberIds.Except(anyStintThisSeason).ToList();
        var arm2Ids = new HashSet<int>();
        if (arm2Candidates.Count > 0)
        {
            foreach (var id in await _context.PlayerAssessments
                .Where(a => a.SeasonId == seasonId && arm2Candidates.Contains(a.PlayerId))
                .Select(a => a.PlayerId).Distinct().ToListAsync()) arm2Ids.Add(id);
            foreach (var id in await _context.ObjectiveTestResults
                .Where(t => t.SeasonId == seasonId && arm2Candidates.Contains(t.PlayerId))
                .Select(t => t.PlayerId).Distinct().ToListAsync()) arm2Ids.Add(id);
            foreach (var id in await _context.MatchPerformances
                .Where(m => m.SeasonId == seasonId && arm2Candidates.Contains(m.PlayerId))
                .Select(m => m.PlayerId).Distinct().ToListAsync()) arm2Ids.Add(id);
            foreach (var id in await _context.ImprovementPlans
                .Where(p => p.SeasonId == seasonId && arm2Candidates.Contains(p.PlayerId))
                .Select(p => p.PlayerId).Distinct().ToListAsync()) arm2Ids.Add(id);
        }

        var allIds = rosterPlayerIds.Union(arm2Ids).ToList();
        var players = await _context.Players
            .Include(p => p.Position)
            .Where(p => allIds.Contains(p.Id))
            .OrderBy(p => p.FullName)
            .ToListAsync();

        return new SeasonTeamPopulation { Players = players, RosterStints = stints };
    }

    public async Task<int> CountUnassignedAsync(int teamId, IReadOnlyCollection<int> populationPlayerIds)
    {
        var count = 0;
        count += await _context.MatchResults.CountAsync(m => m.TeamId == teamId && m.SeasonId == null);
        count += await _context.TrainingSessions.CountAsync(s => s.TeamId == teamId && s.SeasonId == null);
        count += await _context.ScheduledSessions.CountAsync(s => s.TeamId == teamId && s.SeasonId == null);
        if (populationPlayerIds.Count > 0)
        {
            count += await _context.PlayerAssessments.CountAsync(a => populationPlayerIds.Contains(a.PlayerId) && a.SeasonId == null);
            count += await _context.ObjectiveTestResults.CountAsync(t => populationPlayerIds.Contains(t.PlayerId) && t.SeasonId == null);
            count += await _context.MatchPerformances.CountAsync(m => populationPlayerIds.Contains(m.PlayerId) && m.SeasonId == null);
            count += await _context.ImprovementPlans.CountAsync(p => populationPlayerIds.Contains(p.PlayerId) && p.SeasonId == null);
        }
        return count;
    }
}
