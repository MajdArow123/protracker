using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

public enum SeasonResolutionOutcome
{
    Resolved = 0,
    NoCoveringSeason = 1,
    Ambiguous = 2,
}

// The resolver's answer. Callers branch on Outcome — NoCoveringSeason and Ambiguous
// both leave SeasonId null, but they are different states: the first means "no season
// covers this date", the second means "more than one does, a human must pick"
// (CandidateSeasonIds names them, sorted ascending; empty for the other outcomes).
public readonly record struct SeasonResolution(
    SeasonResolutionOutcome Outcome,
    int? SeasonId,
    IReadOnlyList<int> CandidateSeasonIds)
{
    private static readonly int[] NoCandidates = Array.Empty<int>();

    public static SeasonResolution Resolved(int seasonId) =>
        new(SeasonResolutionOutcome.Resolved, seasonId, NoCandidates);

    public static SeasonResolution NoCoveringSeason() =>
        new(SeasonResolutionOutcome.NoCoveringSeason, null, NoCandidates);

    public static SeasonResolution Ambiguous(IReadOnlyList<int> candidateSeasonIds) =>
        new(SeasonResolutionOutcome.Ambiguous, null, candidateSeasonIds);
}

// Phase 10 S2/S2.1: pure season lookup — no writes, no side effects, and deliberately no
// ApplicationUser.CurrentSeasonId fallback (that's a UI write-default consumed by the
// S3 create paths, never a resolver input). Every rule resolves toward NoCoveringSeason
// over a guess: unassigned is the honest state, and the S7 backfill tool exists precisely
// so a human settles what the resolver refuses to.
//
// DATE SEMANTICS: a season boundary is a DAY, not an instant — hence DateOnly. The
// stored columns are DateTime (midnight UTC in practice, because the UI collects
// date-only input), but the resolver never trusts that: comparisons are day-granular
// against any stored time component. StartDate/JoinedAt days count wholly (a player
// joined at 18:00 on day X is on the roster for all of day X), and EndDate/LeftAt days
// count wholly too (the final day of a season is inside the season).
//
// (The spec's two "overloads" both take (int, DateOnly), which C# can't overload —
// hence the two names.)
public interface ISeasonResolver
{
    // TEAM CONTEXT: the season in which this team participates (SeasonTeam row) whose
    // [StartDate, EndDate] window contains the day, inclusive on both ends.
    Task<SeasonResolution> ResolveForTeamAsync(int teamId, DateOnly date);

    // PLAYER CONTEXT: resolves via SeasonRoster ONLY — the roster row whose
    // [JoinedAt, LeftAt] (LeftAt null = still on) covers the day, AND whose season's
    // own [StartDate, EndDate] window covers it too (S6 clamp — see below). NEVER
    // routes through Player.TeamId: that field is "where are they now", and using it
    // for a historical record is the exact bug SeasonRoster exists to prevent.
    Task<SeasonResolution> ResolveForPlayerAsync(int playerId, DateOnly date);

    // Phase 10 S7: batch variants for the backfill sweep — one query loads every
    // candidate window for the context, then each date is classified with the SAME
    // day-granular comparisons as the single methods (equivalence is test-pinned
    // across the S2/S6 boundary matrix in SeasonBackfillTests). Single-record
    // semantics above are untouched. Returns one entry per DISTINCT input date.
    Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForTeamBatchAsync(
        int teamId, IReadOnlyCollection<DateOnly> dates);
    Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForPlayerBatchAsync(
        int playerId, IReadOnlyCollection<DateOnly> dates);
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

    public async Task<SeasonResolution> ResolveForTeamAsync(int teamId, DateOnly date)
    {
        // Both methods take a bare int, so a playerId passed here compiles and would
        // return a plausible wrong answer. The existence guard turns that mistake into
        // a logged NoCoveringSeason instead of silent misattribution.
        if (!await _context.Teams.AnyAsync(t => t.Id == teamId))
        {
            _logger.LogWarning(
                "ResolveForTeamAsync called with team id {TeamId}, which does not exist — wrong id type?",
                teamId);
            return SeasonResolution.NoCoveringSeason();
        }

        var (dayStart, nextDay) = DayWindow(date);
        var candidateIds = await _context.Seasons
            .Where(s => s.Status != SeasonStatus.Archived
                // Day-granular: StartDate's day <= date <=> StartDate < nextDay,
                // date <= EndDate's day <=> EndDate >= dayStart. Plain DateTime
                // comparisons stay translatable on both Npgsql and the SQLite rig.
                && s.StartDate < nextDay && s.EndDate >= dayStart
                && s.SeasonTeams.Any(st => st.TeamId == teamId))
            .Select(s => s.Id)
            .ToListAsync();

        return Classify(candidateIds, $"team {teamId}", date);
    }

    public async Task<SeasonResolution> ResolveForPlayerAsync(int playerId, DateOnly date)
    {
        if (!await _context.Players.AnyAsync(p => p.Id == playerId))
        {
            _logger.LogWarning(
                "ResolveForPlayerAsync called with player id {PlayerId}, which does not exist — wrong id type?",
                playerId);
            return SeasonResolution.NoCoveringSeason();
        }

        // SeasonRoster is the historical truth. A covering roster row is required —
        // no row means the player wasn't rostered anywhere on that date (a gap, a
        // pre-join date, or after leaving), and the answer is NoCoveringSeason even
        // when Player.TeamId currently points at a team with a covering season.
        // Two roster rows in the SAME season covering one date (e.g. data written
        // around a rejoin) are still unambiguously that season — hence Distinct.
        //
        // S6 CLAMP: the date must fall inside the SEASON's own window too, exactly
        // like the team path. Until S6 this method checked only the stint dates —
        // an asymmetry that was invisible while SeasonRosters had zero rows. With
        // real rows it would have been live: the common open-ended stint (LeftAt
        // null, the UI default) would resolve its season for every later date
        // FOREVER, so an off-season record after EndDate would silently stamp the
        // finished season instead of honestly staying unassigned. The invariant
        // lives here, not in stint-date validation — resolver correctness must not
        // depend on validation elsewhere staying perfect.
        var (dayStart, nextDay) = DayWindow(date);
        var candidateIds = await _context.SeasonRosters
            .Where(r => r.PlayerId == playerId
                && r.JoinedAt < nextDay && (r.LeftAt == null || r.LeftAt >= dayStart)
                && r.Season.StartDate < nextDay && r.Season.EndDate >= dayStart
                && r.Season.Status != SeasonStatus.Archived)
            .Select(r => r.SeasonId)
            .Distinct()
            .ToListAsync();

        return Classify(candidateIds, $"player {playerId}", date);
    }

    public async Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForTeamBatchAsync(
        int teamId, IReadOnlyCollection<DateOnly> dates)
    {
        var result = new Dictionary<DateOnly, SeasonResolution>();
        if (dates.Count == 0) return result;

        if (!await _context.Teams.AnyAsync(t => t.Id == teamId))
        {
            _logger.LogWarning(
                "ResolveForTeamBatchAsync called with team id {TeamId}, which does not exist — wrong id type?",
                teamId);
            foreach (var date in dates.Distinct()) result[date] = SeasonResolution.NoCoveringSeason();
            return result;
        }

        // One query for the context, dates classified in memory — the comparisons are
        // byte-for-byte the single method's (StartDate < nextDay && EndDate >= dayStart).
        var windows = await _context.Seasons
            .Where(s => s.Status != SeasonStatus.Archived
                && s.SeasonTeams.Any(st => st.TeamId == teamId))
            .Select(s => new { s.Id, s.StartDate, s.EndDate })
            .ToListAsync();

        foreach (var date in dates.Distinct())
        {
            var (dayStart, nextDay) = DayWindow(date);
            var candidateIds = windows
                .Where(w => w.StartDate < nextDay && w.EndDate >= dayStart)
                .Select(w => w.Id)
                .ToList();
            result[date] = Classify(candidateIds, $"team {teamId}", date);
        }
        return result;
    }

    public async Task<IReadOnlyDictionary<DateOnly, SeasonResolution>> ResolveForPlayerBatchAsync(
        int playerId, IReadOnlyCollection<DateOnly> dates)
    {
        var result = new Dictionary<DateOnly, SeasonResolution>();
        if (dates.Count == 0) return result;

        if (!await _context.Players.AnyAsync(p => p.Id == playerId))
        {
            _logger.LogWarning(
                "ResolveForPlayerBatchAsync called with player id {PlayerId}, which does not exist — wrong id type?",
                playerId);
            foreach (var date in dates.Distinct()) result[date] = SeasonResolution.NoCoveringSeason();
            return result;
        }

        var stints = await _context.SeasonRosters
            .Where(r => r.PlayerId == playerId && r.Season.Status != SeasonStatus.Archived)
            .Select(r => new
            {
                r.SeasonId,
                r.JoinedAt,
                r.LeftAt,
                SeasonStart = r.Season.StartDate,
                SeasonEnd = r.Season.EndDate,
            })
            .ToListAsync();

        foreach (var date in dates.Distinct())
        {
            var (dayStart, nextDay) = DayWindow(date);
            var candidateIds = stints
                .Where(s => s.JoinedAt < nextDay && (s.LeftAt == null || s.LeftAt >= dayStart)
                    && s.SeasonStart < nextDay && s.SeasonEnd >= dayStart)
                .Select(s => s.SeasonId)
                .Distinct()
                .ToList();
            result[date] = Classify(candidateIds, $"player {playerId}", date);
        }
        return result;
    }

    private static (DateTime DayStart, DateTime NextDay) DayWindow(DateOnly date)
    {
        // Npgsql requires Kind=Utc for timestamptz parameters; stored values are UTC
        // via the global converter.
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return (dayStart, dayStart.AddDays(1));
    }

    // Overlapping seasons are allowed, so >1 match is a real state — Ambiguous names
    // the candidates rather than silently picking one. A wrong season on a row is
    // worse than an unassigned row.
    private SeasonResolution Classify(List<int> candidateIds, string context, DateOnly date)
    {
        if (candidateIds.Count == 0) return SeasonResolution.NoCoveringSeason();
        if (candidateIds.Count == 1) return SeasonResolution.Resolved(candidateIds[0]);

        var sorted = candidateIds.OrderBy(id => id).ToList();
        _logger.LogWarning(
            "Season resolution for {Context} on {Date} is ambiguous — candidates: {SeasonIds}. " +
            "Returning null; assign explicitly (S7 backfill).",
            context, date.ToString("yyyy-MM-dd"), string.Join(", ", sorted));
        return SeasonResolution.Ambiguous(sorted);
    }
}
