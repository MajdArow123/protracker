using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// Phase 10 S7: retroactive season stamping for pre-Phase-10 records. Rulings D1–D7:
// - D1 resolver reuse: every record's date goes through SeasonResolver (batch variants,
//   equivalence test-pinned). A gap or ambiguous date stays NULL — no nearest-season,
//   no invented "Legacy" season, no loose matching.
// - D2 idempotent, NULL-only: candidates are SeasonId IS NULL rows; execute re-guards
//   IS NULL inside each batch transaction, so a non-NULL stamp is never overwritten and
//   a re-run is a no-op.
// - D3 scope: the S1b columns, EXCEPT EvidenceBasedScore — its SeasonId is computation
//   provenance ("WHEN computed", restamped by the engine on every recalc), pinned as
//   "not backfillable history" by the S6 ruling; the S6 unstamped-in-window count
//   already excludes it so that number matches what this tool stamps. Lineup candidates
//   are MATCH lineups only (Default-XI/named lineups are deliberately unstamped
//   templates). SeasonRoster stints are §5d's problem, not ours.
// - D4: BenchmarkProfileId snapshots stay NULL — "the profile in effect at creation
//   time" cannot be honestly reconstructed after the fact.
// - D5 owner-only: candidates scope to the caller's own graph (teams they head-coach,
//   players on or historically rostered to those teams, legacy plans they authored).
//   A caller who owns no seasons gets a 404 — there is nothing to backfill into, and
//   this is the concrete "assistant coaches cannot run it" contract (assistants own
//   no seasons; athletes are stopped by the role gate).
// - D6: preview computes everything and writes NOTHING; execute writes a
//   SeasonBackfillRun audit row (owner, UTC time, per-entity counts, stamped ids as
//   jsonb — the mechanical revert path; no revert endpoint in S7 by ruling).
// - D7: set-based stamping in chunks of 500 per transaction per (entity, season) —
//   never one giant transaction.
public interface ISeasonBackfillService
{
    Task<SeasonBackfillPreviewDto> PreviewAsync(ClaimsPrincipal user);
    Task<SeasonBackfillResultDto> ExecuteAsync(ClaimsPrincipal user);
}

public class SeasonBackfillService : ISeasonBackfillService
{
    private const int BatchSize = 500;

    // Stable render order for the wire; keys are also the CountsJson/StampedIdsJson keys.
    private static readonly string[] EntityOrder =
    {
        "matchResults", "playerAssessments", "objectiveTests", "matchPerformances",
        "improvementPlans", "lineups", "trainingSessions", "scheduledSessions",
        "trainingPlans",
    };

    private readonly ApplicationDbContext _context;
    private readonly ISeasonResolver _resolver;
    private readonly IAccessControlService _access;
    private readonly ILogger<SeasonBackfillService> _logger;

    public SeasonBackfillService(
        ApplicationDbContext context,
        ISeasonResolver resolver,
        IAccessControlService access,
        ILogger<SeasonBackfillService> logger)
    {
        _context = context;
        _resolver = resolver;
        _access = access;
        _logger = logger;
    }

    public async Task<SeasonBackfillPreviewDto> PreviewAsync(ClaimsPrincipal user)
    {
        var userId = await RequireBackfillOwnerAsync(user);
        var resolved = await CollectAndResolveAsync(userId);
        var dto = new SeasonBackfillPreviewDto();
        await FillCountsAsync(dto, resolved, (_, list) =>
            list.Where(x => x.Resolution.Outcome == SeasonResolutionOutcome.Resolved)
                .GroupBy(x => x.Resolution.SeasonId!.Value)
                .ToDictionary(g => g.Key, g => g.Count()));
        return dto;
    }

    public async Task<SeasonBackfillResultDto> ExecuteAsync(ClaimsPrincipal user)
    {
        var userId = await RequireBackfillOwnerAsync(user);
        var resolved = await CollectAndResolveAsync(userId);

        // Stamp per (entity, season) in chunks; only rows STILL NULL inside the chunk's
        // transaction are touched, and exactly those ids go into the audit payload.
        var stampedIds = new Dictionary<string, List<int>>();
        var stampedBySeason = new Dictionary<string, Dictionary<int, int>>();
        foreach (var entity in EntityOrder)
        {
            stampedIds[entity] = new List<int>();
            stampedBySeason[entity] = new Dictionary<int, int>();
            var groups = resolved[entity]
                .Where(x => x.Resolution.Outcome == SeasonResolutionOutcome.Resolved)
                .GroupBy(x => x.Resolution.SeasonId!.Value);
            foreach (var group in groups)
            {
                var ids = group.Select(x => x.Id).ToList();
                foreach (var chunk in ids.Chunk(BatchSize))
                {
                    var stamped = await StampChunkAsync(entity, chunk.ToList(), group.Key);
                    stampedIds[entity].AddRange(stamped);
                    if (stamped.Count > 0)
                        stampedBySeason[entity][group.Key] =
                            stampedBySeason[entity].GetValueOrDefault(group.Key) + stamped.Count;
                }
            }
        }

        var dto = new SeasonBackfillResultDto();
        await FillCountsAsync(dto, resolved, (entity, _) => stampedBySeason[entity]);

        var run = new SeasonBackfillRun
        {
            OwnerId = userId,
            RanAt = DateTime.UtcNow,
            CountsJson = JsonSerializer.Serialize(dto.Entities.ToDictionary(
                x => x.EntityType,
                x => new { stamped = x.Stamped, gap = x.Gap, ambiguous = x.Ambiguous })),
            StampedIdsJson = JsonSerializer.Serialize(stampedIds),
        };
        _context.SeasonBackfillRuns.Add(run);
        await _context.SaveChangesAsync();

        dto.RunId = run.Id;
        dto.RanAt = run.RanAt;
        _logger.LogInformation(
            "Season backfill run {RunId} by {OwnerId}: {Stamped} stamped, {Gap} gap, {Ambiguous} ambiguous",
            run.Id, userId, dto.TotalStamped, dto.TotalGap, dto.TotalAmbiguous);
        return dto;
    }

    // ---- shared plumbing ----

    private sealed record Candidate(int Id, bool TeamContext, int ContextId, DateOnly Date);

    private sealed record ResolvedCandidate(int Id, SeasonResolution Resolution);

    private async Task<string> RequireBackfillOwnerAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        // Owning zero seasons means there is nothing to backfill into — 404, matching
        // the project's season contract (and keeping assistants out without a special
        // role check: assistants don't own seasons).
        if (!await _context.Seasons.AnyAsync(s => s.OwnerId == userId))
            throw new NotFoundApiException("No seasons were found for this account.");
        return userId;
    }

    private async Task<Dictionary<string, List<ResolvedCandidate>>> CollectAndResolveAsync(string userId)
    {
        var ownedTeamIds = await _context.Teams
            .Where(t => t.CoachId == userId)
            .Select(t => t.Id)
            .ToListAsync();
        // Players currently on an owned team PLUS players with a historical stint on
        // one (§5g: departed players' records are still the coach's program history).
        var stintPlayerIds = await _context.SeasonRosters
            .Where(r => ownedTeamIds.Contains(r.TeamId))
            .Select(r => r.PlayerId)
            .Distinct()
            .ToListAsync();
        var currentPlayerIds = await _context.Players
            .Where(p => p.TeamId != null && ownedTeamIds.Contains(p.TeamId.Value))
            .Select(p => p.Id)
            .ToListAsync();
        var playerIds = currentPlayerIds.Union(stintPlayerIds).ToList();

        var candidates = new Dictionary<string, List<Candidate>>();

        candidates["matchResults"] = (await _context.MatchResults
            .Where(m => m.SeasonId == null
                && ((m.TeamId != null && ownedTeamIds.Contains(m.TeamId.Value))
                    || (m.TeamId == null && m.PlayerId != null && playerIds.Contains(m.PlayerId.Value))))
            .Select(m => new { m.Id, m.TeamId, m.PlayerId, m.MatchDate })
            .ToListAsync())
            .Select(m => m.TeamId != null
                ? new Candidate(m.Id, true, m.TeamId.Value, DateOnly.FromDateTime(m.MatchDate))
                : new Candidate(m.Id, false, m.PlayerId!.Value, DateOnly.FromDateTime(m.MatchDate)))
            .ToList();

        candidates["playerAssessments"] = (await _context.PlayerAssessments
            .Where(a => a.SeasonId == null && playerIds.Contains(a.PlayerId))
            .Select(a => new { a.Id, a.PlayerId, a.DateRecorded })
            .ToListAsync())
            .Select(a => new Candidate(a.Id, false, a.PlayerId, DateOnly.FromDateTime(a.DateRecorded)))
            .ToList();

        candidates["objectiveTests"] = (await _context.ObjectiveTestResults
            .Where(t => t.SeasonId == null && playerIds.Contains(t.PlayerId))
            .Select(t => new { t.Id, t.PlayerId, t.TestedAt })
            .ToListAsync())
            .Select(t => new Candidate(t.Id, false, t.PlayerId, DateOnly.FromDateTime(t.TestedAt)))
            .ToList();

        candidates["matchPerformances"] = (await _context.MatchPerformances
            .Where(p => p.SeasonId == null && playerIds.Contains(p.PlayerId))
            .Select(p => new { p.Id, p.PlayerId, p.MatchDate })
            .ToListAsync())
            .Select(p => new Candidate(p.Id, false, p.PlayerId, DateOnly.FromDateTime(p.MatchDate)))
            .ToList();

        candidates["improvementPlans"] = (await _context.ImprovementPlans
            .Where(p => p.SeasonId == null && playerIds.Contains(p.PlayerId))
            .Select(p => new { p.Id, p.PlayerId, p.CreatedDate })
            .ToListAsync())
            .Select(p => new Candidate(p.Id, false, p.PlayerId, DateOnly.FromDateTime(p.CreatedDate)))
            .ToList();

        // Match lineups only: Default-XI/named lineups are unstamped templates by the
        // S3 ruling and are NOT candidates (they'd otherwise all report as "gap", which
        // would be a lie — they're not unassigned, they're unassignable by design).
        candidates["lineups"] = (await _context.Lineups
            .Where(l => l.SeasonId == null && l.MatchResultId != null && ownedTeamIds.Contains(l.TeamId))
            .Select(l => new { l.Id, l.TeamId, l.MatchResult!.MatchDate })
            .ToListAsync())
            .Select(l => new Candidate(l.Id, true, l.TeamId, DateOnly.FromDateTime(l.MatchDate)))
            .ToList();

        // Team context per S3 ("the record pins its own TeamId, so that + its own Date
        // is historically exact").
        candidates["trainingSessions"] = (await _context.TrainingSessions
            .Where(s => s.SeasonId == null && ownedTeamIds.Contains(s.TeamId))
            .Select(s => new { s.Id, s.TeamId, s.Date })
            .ToListAsync())
            .Select(s => new Candidate(s.Id, true, s.TeamId, DateOnly.FromDateTime(s.Date)))
            .ToList();

        // Historical rows carry only the stored StartTime instant; its UTC date part is
        // the driving date (the S2.2 local-date ruling is about a live client's "today"
        // — there is no client-local information to recover here).
        candidates["scheduledSessions"] = (await _context.ScheduledSessions
            .Where(s => s.SeasonId == null
                && ((s.TeamId != null && ownedTeamIds.Contains(s.TeamId.Value))
                    || (s.TeamId == null && s.PlayerId != null && playerIds.Contains(s.PlayerId.Value))))
            .Select(s => new { s.Id, s.TeamId, s.PlayerId, s.StartTime })
            .ToListAsync())
            .Select(s => s.TeamId != null
                ? new Candidate(s.Id, true, s.TeamId.Value, DateOnly.FromDateTime(s.StartTime))
                : new Candidate(s.Id, false, s.PlayerId!.Value, DateOnly.FromDateTime(s.StartTime)))
            .ToList();

        // Legacy MVC-era model keyed by user-id strings; owned via its own CoachId.
        // AthleteId maps to a Player through Player.UserId; an unmappable row can never
        // resolve (ContextId 0 short-circuits to gap below, no resolver call).
        var legacyPlans = await _context.TrainingPlans
            .Where(tp => tp.SeasonId == null && tp.CoachId == userId)
            .Select(tp => new { tp.TrainingPlanId, tp.AthleteId, tp.StartDate })
            .ToListAsync();
        var legacyAthleteIds = legacyPlans.Select(tp => tp.AthleteId).Distinct().ToList();
        var userToPlayer = await _context.Players
            .Where(p => p.UserId != null && legacyAthleteIds.Contains(p.UserId))
            .GroupBy(p => p.UserId!)
            .Select(g => new { UserId = g.Key, PlayerId = g.Min(p => p.Id) })
            .ToDictionaryAsync(x => x.UserId, x => x.PlayerId);
        candidates["trainingPlans"] = legacyPlans
            .Select(tp => new Candidate(
                tp.TrainingPlanId,
                false,
                userToPlayer.GetValueOrDefault(tp.AthleteId),
                DateOnly.FromDateTime(tp.StartDate)))
            .ToList();

        // Resolve once per (context, date) across all entities.
        var memo = new Dictionary<(bool TeamCtx, int CtxId, DateOnly Date), SeasonResolution>();
        foreach (var group in candidates.Values.SelectMany(v => v)
            .Where(c => c.ContextId > 0)
            .GroupBy(c => (c.TeamContext, c.ContextId)))
        {
            var dates = group.Select(c => c.Date).Distinct().ToList();
            var map = group.Key.TeamContext
                ? await _resolver.ResolveForTeamBatchAsync(group.Key.ContextId, dates)
                : await _resolver.ResolveForPlayerBatchAsync(group.Key.ContextId, dates);
            foreach (var (date, resolution) in map)
                memo[(group.Key.TeamContext, group.Key.ContextId, date)] = resolution;
        }

        return candidates.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.Select(c => new ResolvedCandidate(
                c.Id,
                c.ContextId > 0
                    ? memo[(c.TeamContext, c.ContextId, c.Date)]
                    : SeasonResolution.NoCoveringSeason())).ToList());
    }

    // The one sanctioned write. Re-guards SeasonId IS NULL inside the chunk's own
    // transaction (D2) and returns exactly the ids it stamped. Set-based on purpose:
    // only SeasonId moves — no UpdatedAt churn, no Lineup.Version bump (stamping is
    // server metadata, mirroring the S3+ cascade ruling).
    private Task<List<int>> StampChunkAsync(string entity, List<int> ids, int seasonId) => entity switch
    {
        "matchResults" => StampChunkAsync(_context.MatchResults, "Id", ids, seasonId),
        "playerAssessments" => StampChunkAsync(_context.PlayerAssessments, "Id", ids, seasonId),
        "objectiveTests" => StampChunkAsync(_context.ObjectiveTestResults, "Id", ids, seasonId),
        "matchPerformances" => StampChunkAsync(_context.MatchPerformances, "Id", ids, seasonId),
        "improvementPlans" => StampChunkAsync(_context.ImprovementPlans, "Id", ids, seasonId),
        "lineups" => StampChunkAsync(_context.Lineups, "Id", ids, seasonId),
        "trainingSessions" => StampChunkAsync(_context.TrainingSessions, "Id", ids, seasonId),
        "scheduledSessions" => StampChunkAsync(_context.ScheduledSessions, "Id", ids, seasonId),
        "trainingPlans" => StampChunkAsync(
            _context.TrainingPlans, nameof(TrainingPlan.TrainingPlanId), ids, seasonId),
        _ => throw new InvalidOperationException($"Unknown backfill entity '{entity}'"),
    };

    private async Task<List<int>> StampChunkAsync<T>(
        DbSet<T> set, string keyName, List<int> ids, int seasonId) where T : class
    {
        await using var tx = await _context.Database.BeginTransactionAsync();
        var still = await set
            .Where(e => EF.Property<int?>(e, "SeasonId") == null
                && ids.Contains(EF.Property<int>(e, keyName)))
            .Select(e => EF.Property<int>(e, keyName))
            .ToListAsync();
        if (still.Count > 0)
        {
            await set
                .Where(e => still.Contains(EF.Property<int>(e, keyName)))
                .ExecuteUpdateAsync(s => s.SetProperty(
                    e => EF.Property<int?>(e, "SeasonId"), seasonId));
        }
        await tx.CommitAsync();
        return still;
    }

    private async Task FillCountsAsync(
        SeasonBackfillPreviewDto dto,
        Dictionary<string, List<ResolvedCandidate>> resolved,
        Func<string, List<ResolvedCandidate>, Dictionary<int, int>> stampedBySeason)
    {
        var seasonIds = new HashSet<int>();
        foreach (var entity in EntityOrder)
        {
            var list = resolved[entity];
            var bySeason = stampedBySeason(entity, list);
            foreach (var id in bySeason.Keys) seasonIds.Add(id);
            dto.Entities.Add(new SeasonBackfillEntityDto
            {
                EntityType = entity,
                TotalCandidates = list.Count,
                Stamped = bySeason.Values.Sum(),
                Gap = list.Count(x => x.Resolution.Outcome == SeasonResolutionOutcome.NoCoveringSeason),
                Ambiguous = list.Count(x => x.Resolution.Outcome == SeasonResolutionOutcome.Ambiguous),
                BySeason = bySeason
                    .OrderBy(kv => kv.Key)
                    .Select(kv => new SeasonBackfillSeasonCountDto { SeasonId = kv.Key, Count = kv.Value })
                    .ToList(),
            });
        }

        var names = await _context.Seasons
            .Where(s => seasonIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);
        foreach (var row in dto.Entities.SelectMany(e => e.BySeason))
            row.SeasonName = names.GetValueOrDefault(row.SeasonId, "");

        dto.TotalCandidates = dto.Entities.Sum(e => e.TotalCandidates);
        dto.TotalStamped = dto.Entities.Sum(e => e.Stamped);
        dto.TotalGap = dto.Entities.Sum(e => e.Gap);
        dto.TotalAmbiguous = dto.Entities.Sum(e => e.Ambiguous);
    }
}
