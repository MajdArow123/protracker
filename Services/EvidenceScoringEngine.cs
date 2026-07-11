using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

// The core evidence-based score calculation. Sport-agnostic: everything sport-specific
// lives in the seeded SportMetricDefinition benchmarks/weights and the MatchStatMapping
// table below. Pure math (normalization, weighting, confidence) is exposed as public
// statics so it can be unit-tested without a database.
public interface IEvidenceScoringEngine
{
    // Calculate (and upsert) the score for one player+metric. Returns null when the
    // player has no evidence at all for the metric.
    Task<EvidenceBasedScore?> CalculateScoreAsync(int playerId, int metricDefinitionId, int? assessmentId = null);

    // Recalculate every metric of the player's sport in one pass (single evidence load).
    Task<List<EvidenceBasedScore>> RecalculateAllAsync(int playerId);

    // Human-readable list of evidence still missing for a metric (to raise confidence).
    Task<List<string>> GetMissingEvidenceAsync(int playerId, int metricDefinitionId);

    // Benchmark calibration: the player's team profile anchors per metric id
    // (empty = metric-definition defaults apply).
    Task<Dictionary<int, (decimal Low, decimal Mid, decimal High)>> GetBenchmarkOverridesAsync(int playerId);
}

public class EvidenceScoringEngine : IEvidenceScoringEngine
{
    // Evidence older than this no longer counts toward a score (spec: confidence never
    // falls unless old evidence expires).
    public const int EvidenceWindowDays = 90;

    private readonly ApplicationDbContext _context;

    public EvidenceScoringEngine(ApplicationDbContext context)
    {
        _context = context;
    }

    // ─── Pure calculation (unit-testable statics) ────────────────────────────

    // Maps a raw objective test value onto 1-10 through the three benchmark anchors:
    // BenchmarkLow → 3, BenchmarkMid → 5, BenchmarkHigh → 10, linear between anchors,
    // extrapolated below Low (down to the 1 clamp) and clamped at 10 above High.
    // Works in either direction (Low > High for "lower is better" tests like sprints).
    public static decimal NormalizeObjectiveValue(decimal value, decimal low, decimal mid, decimal high)
    {
        if (low == mid || mid == high)
            return Math.Clamp(Math.Round(value, 1), 1m, 10m); // degenerate anchors: treat as 1-10 already

        var t1 = (value - low) / (mid - low);
        decimal score;
        if (t1 <= 1)
        {
            score = 3m + t1 * 2m;
        }
        else
        {
            var t2 = (value - mid) / (high - mid);
            score = 5m + t2 * 5m;
        }
        return Math.Clamp(Math.Round(score, 1), 1m, 10m);
    }

    // When a benchmark-profile override exists for the metric (age/level calibration),
    // its anchors replace the definition defaults.
    public static decimal NormalizeObjectiveValue(decimal value, SportMetricDefinition def,
        (decimal Low, decimal Mid, decimal High)? benchmarkOverride = null)
    {
        if (def.InputType == MetricInputType.Rating)
            return Math.Clamp(Math.Round(value, 1), 1m, 10m);
        var (low, mid, high) = benchmarkOverride ?? (def.BenchmarkLow, def.BenchmarkMid, def.BenchmarkHigh);
        return NormalizeObjectiveValue(value, low, mid, high);
    }

    // Redistributes the definition's source weights across the sources that actually
    // have data, so missing evidence is skipped rather than penalized. Sums to 1
    // (or all zeros when nothing is present).
    public static (decimal Objective, decimal Match, decimal Coach, decimal Self) RedistributeWeights(
        SportMetricDefinition def, bool hasObjective, bool hasMatch, bool hasCoach, bool hasSelf)
    {
        var obj = hasObjective ? def.ObjectiveTestWeight : 0m;
        var match = hasMatch ? def.MatchStatWeight : 0m;
        var coach = hasCoach ? def.CoachEvalWeight : 0m;
        var self = hasSelf ? def.SelfAssessWeight : 0m;
        var sum = obj + match + coach + self;
        if (sum == 0) return (0, 0, 0, 0);
        return (obj / sum, match / sum, coach / sum, self / sum);
    }

    public static EvidenceConfidence GetConfidenceLevel(
        bool hasObjective, bool hasMatch, bool hasCoach, bool hasSelf, bool objectiveRequired)
    {
        var count = (hasObjective ? 1 : 0) + (hasMatch ? 1 : 0) + (hasCoach ? 1 : 0) + (hasSelf ? 1 : 0);
        if (count == 0) return EvidenceConfidence.Low;
        if (objectiveRequired && !hasObjective) return EvidenceConfidence.Low;
        if (hasObjective && hasMatch && hasCoach && hasSelf) return EvidenceConfidence.VeryHigh;
        if ((hasObjective && hasCoach) || count >= 3) return EvidenceConfidence.High;
        if (count >= 2) return EvidenceConfidence.Medium;
        return EvidenceConfidence.Low;
    }

    public static ScoreCalculationMethod GetCalculationMethod(
        bool hasObjective, bool hasMatch, bool hasCoach, bool hasSelf)
    {
        var measured = hasObjective || hasMatch;
        var subjective = hasCoach || hasSelf;
        if (measured && subjective) return ScoreCalculationMethod.Hybrid;
        if (measured) return ScoreCalculationMethod.Calculated;
        return ScoreCalculationMethod.Manual;
    }

    // ─── Match stat mapping (sport-specific) ─────────────────────────────────

    // How a metric's per-match evidence value is derived from the flat stats JSON, plus
    // the benchmark anchors that value is normalized against (same 3→5→10 anchoring as
    // objective tests). Metrics without an entry simply have no match-stat evidence.
    private sealed record MatchStatRule(Func<Dictionary<string, decimal>, decimal?> Extract,
        decimal Low, decimal Mid, decimal High);

    private static decimal? Get(Dictionary<string, decimal> s, string key) =>
        s.TryGetValue(key, out var v) ? v : null;

    private static decimal? Ratio(Dictionary<string, decimal> s, string num, string den)
    {
        var n = Get(s, num);
        var d = Get(s, den);
        if (n == null || d is null or 0) return null;
        return n / d;
    }

    // Sum of whichever keys are present; null when none are.
    private static decimal? Sum(Dictionary<string, decimal> s, params string[] keys)
    {
        var values = keys.Select(k => Get(s, k)).Where(v => v != null).ToList();
        return values.Count == 0 ? null : values.Sum(v => v!.Value);
    }

    private static readonly Dictionary<(int SportId, string Metric), MatchStatRule> MatchStatRules = new()
    {
        // Soccer (1)
        [(1, "Stamina")] = new(s => Get(s, "distanceKm"), 8, 10, 12),
        [(1, "Passing")] = new(s => Get(s, "passAccuracy"), 50, 70, 90),
        [(1, "Shooting")] = new(s => Ratio(s, "shotsOnTarget", "shots") * 100, 20, 45, 70),
        [(1, "Dribbling")] = new(s => Get(s, "dribbles"), 1, 3, 7),
        [(1, "Defending")] = new(s => Sum(s, "tackles", "interceptions"), 1, 4, 8),
        // Basketball (2)
        [(2, "Shooting")] = new(s => Get(s, "fgPercentage"), 30, 45, 60),
        [(2, "Passing")] = new(s => Get(s, "assists") / Math.Max(Get(s, "turnovers") ?? 1m, 1m), 0.5m, 1.5m, 3.5m),
        [(2, "Rebounding")] = new(s => Get(s, "rebounds"), 2, 6, 12),
        [(2, "Defense")] = new(s => Sum(s, "steals", "blocks"), 0.5m, 2, 5),
        [(2, "Court Vision")] = new(s => Get(s, "assists"), 1, 4, 9),
        [(2, "Ball Handling")] = new(s => Get(s, "turnovers"), 6, 3, 1),
        [(2, "Decision Making")] = new(s => Get(s, "turnovers"), 6, 3, 1),
        [(2, "Conditioning")] = new(s => Get(s, "minutesPlayed"), 10, 24, 36),
        // Volleyball (3)
        [(3, "Serve")] = new(s => Ratio(s, "aces", "serves") * 100, 2, 8, 18),
        [(3, "Attack")] = new(s => Get(s, "killPercentage") ?? Ratio(s, "kills", "attempts") * 100, 20, 35, 55),
        [(3, "Blocking")] = new(s => Get(s, "blocks"), 0.5m, 2, 5),
        [(3, "Defensive Coverage")] = new(s => Get(s, "digs"), 2, 8, 15),
        [(3, "Setting")] = new(s => Get(s, "assists"), 2, 10, 25),
        // Beach volleyball (4)
        [(4, "Serve")] = new(s => Ratio(s, "aces", "serves") * 100, 3, 10, 22),
        [(4, "Attack")] = new(s => Ratio(s, "kills", "attempts") * 100, 25, 40, 60),
        [(4, "Blocking")] = new(s => Get(s, "blocks"), 0.5m, 2, 5),
        [(4, "Digging")] = new(s => Get(s, "digs"), 2, 6, 12),
        // Tennis (5)
        [(5, "Serve")] = new(s => Get(s, "firstServeIn"), 45, 60, 75),
        [(5, "Consistency")] = new(s => Get(s, "unforcedErrors"), 40, 25, 10),
        [(5, "Mental Toughness")] = new(s => Get(s, "breakPointsSaved"), 30, 55, 80),
    };

    // Whether match stats can ever contribute to this sport+metric.
    public static bool HasMatchStatRule(int sportId, string metricName) =>
        MatchStatRules.ContainsKey((sportId, metricName));

    // Averages the metric's derived value across match entries, then normalizes.
    // Returns null when the sport+metric has no mapping or no entry carries the stats.
    public static decimal? ScoreFromMatchStats(int sportId, string metricName,
        IReadOnlyList<Dictionary<string, decimal>> entries)
    {
        if (!MatchStatRules.TryGetValue((sportId, metricName), out var rule) || entries.Count == 0)
            return null;

        var values = entries.Select(rule.Extract).Where(v => v != null).Select(v => v!.Value).ToList();
        if (values.Count == 0) return null;

        return NormalizeObjectiveValue(values.Average(), rule.Low, rule.Mid, rule.High);
    }

    public static Dictionary<string, decimal> ParseStatsJson(string json)
    {
        var result = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return result;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDecimal(out var d))
                    result[prop.Name] = d;
            }
        }
        catch (JsonException)
        {
            // Malformed stats simply contribute no evidence.
        }
        return result;
    }

    // ─── Calculation against the database ────────────────────────────────────

    // All in-window evidence for one player, loaded once and shared across metrics.
    private sealed class EvidenceBundle
    {
        public List<ObjectiveTestResult> Tests = new();
        public List<CoachEvaluation> CoachEvals = new();
        public List<SelfAssessmentEntry> SelfAssessments = new();
        public List<(DateTime Date, Dictionary<string, decimal> Stats)> MatchStats = new();
    }

    public async Task<EvidenceBasedScore?> CalculateScoreAsync(int playerId, int metricDefinitionId, int? assessmentId = null)
    {
        var def = await _context.SportMetricDefinitions.FirstOrDefaultAsync(d => d.Id == metricDefinitionId)
            ?? throw new NotFoundApiException($"Metric definition {metricDefinitionId} was not found.");

        var bundle = await LoadEvidenceAsync(playerId, metricDefinitionId);
        var overrides = await GetBenchmarkOverridesAsync(playerId);
        var score = Compute(playerId, def, bundle, assessmentId, BenchmarkFor(overrides, def.Id));
        if (score == null) return null;

        await UpsertAsync(score);
        await _context.SaveChangesAsync();
        return score;
    }

    public async Task<List<EvidenceBasedScore>> RecalculateAllAsync(int playerId)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        var defs = await _context.SportMetricDefinitions
            .Where(d => d.SportId == player.SportId)
            .ToListAsync();

        var bundle = await LoadEvidenceAsync(playerId, metricDefinitionId: null);
        var overrides = await GetBenchmarkOverridesAsync(playerId);
        var results = new List<EvidenceBasedScore>();
        foreach (var def in defs)
        {
            var score = Compute(playerId, def, bundle, assessmentId: null, BenchmarkFor(overrides, def.Id));
            if (score == null) continue;
            await UpsertAsync(score);
            results.Add(score);
        }
        await _context.SaveChangesAsync();
        return results;
    }

    // The team's benchmark-profile anchors per metric (empty for team-less players).
    public async Task<Dictionary<int, (decimal Low, decimal Mid, decimal High)>> GetBenchmarkOverridesAsync(int playerId)
    {
        var profileId = await _context.Players
            .Where(p => p.Id == playerId)
            .Select(p => p.Team != null ? p.Team.BenchmarkProfileId : null)
            .FirstOrDefaultAsync();
        if (profileId == null) return new();

        return await _context.BenchmarkValues
            .Where(v => v.BenchmarkProfileId == profileId)
            .ToDictionaryAsync(v => v.MetricDefinitionId,
                v => (v.BenchmarkLow, v.BenchmarkMid, v.BenchmarkHigh));
    }

    private static (decimal, decimal, decimal)? BenchmarkFor(
        Dictionary<int, (decimal Low, decimal Mid, decimal High)> overrides, int metricId) =>
        overrides.TryGetValue(metricId, out var o) ? o : null;

    public async Task<List<string>> GetMissingEvidenceAsync(int playerId, int metricDefinitionId)
    {
        var def = await _context.SportMetricDefinitions.FirstOrDefaultAsync(d => d.Id == metricDefinitionId)
            ?? throw new NotFoundApiException($"Metric definition {metricDefinitionId} was not found.");
        var bundle = await LoadEvidenceAsync(playerId, metricDefinitionId);
        var (hasObj, hasMatch, hasCoach, hasSelf) = Presence(def, bundle);
        return MissingEvidence(def, hasObj, hasMatch, hasCoach, hasSelf);
    }

    private async Task<EvidenceBundle> LoadEvidenceAsync(int playerId, int? metricDefinitionId)
    {
        var since = DateTime.UtcNow.AddDays(-EvidenceWindowDays);
        var bundle = new EvidenceBundle();

        var tests = _context.ObjectiveTestResults
            .Where(t => t.PlayerId == playerId && t.TestedAt >= since);
        var coachEvals = _context.CoachEvaluations
            .Where(e => e.PlayerId == playerId && e.EvalDate >= since);
        var selfAssessments = _context.SelfAssessmentEntries
            .Where(e => e.PlayerId == playerId && e.EvalDate >= since);
        if (metricDefinitionId is int metricId)
        {
            tests = tests.Where(t => t.MetricDefinitionId == metricId);
            coachEvals = coachEvals.Where(e => e.MetricDefinitionId == metricId);
            selfAssessments = selfAssessments.Where(e => e.MetricDefinitionId == metricId);
        }

        bundle.Tests = await tests.ToListAsync();
        bundle.CoachEvals = await coachEvals.ToListAsync();
        bundle.SelfAssessments = await selfAssessments.ToListAsync();

        var matchEntries = await _context.MatchStatEntries
            .Where(m => m.PlayerId == playerId && m.StatDate >= since)
            .ToListAsync();
        bundle.MatchStats = matchEntries
            .Select(m => (m.StatDate, ParseStatsJson(m.StatsJson)))
            .ToList();

        return bundle;
    }

    private static (bool Obj, bool Match, bool Coach, bool Self) Presence(SportMetricDefinition def, EvidenceBundle bundle)
    {
        var hasObj = bundle.Tests.Any(t => t.MetricDefinitionId == def.Id);
        var hasCoach = bundle.CoachEvals.Any(e => e.MetricDefinitionId == def.Id);
        var hasSelf = bundle.SelfAssessments.Any(e => e.MetricDefinitionId == def.Id);
        var hasMatch = ScoreFromMatchStats(def.SportId, def.Name, bundle.MatchStats.Select(m => m.Stats).ToList()) != null;
        return (hasObj, hasMatch, hasCoach, hasSelf);
    }

    private static EvidenceBasedScore? Compute(int playerId, SportMetricDefinition def, EvidenceBundle bundle,
        int? assessmentId, (decimal Low, decimal Mid, decimal High)? benchmarkOverride = null)
    {
        // Most recent value wins for point-in-time sources; match stats average over the window.
        var latestTest = bundle.Tests
            .Where(t => t.MetricDefinitionId == def.Id)
            .OrderByDescending(t => t.TestedAt).FirstOrDefault();
        var latestCoach = bundle.CoachEvals
            .Where(e => e.MetricDefinitionId == def.Id)
            .OrderByDescending(e => e.EvalDate).FirstOrDefault();
        var latestSelf = bundle.SelfAssessments
            .Where(e => e.MetricDefinitionId == def.Id)
            .OrderByDescending(e => e.EvalDate).FirstOrDefault();

        var matchEntries = bundle.MatchStats.Select(m => m.Stats).ToList();
        var matchScore = ScoreFromMatchStats(def.SportId, def.Name, matchEntries);

        decimal? objScore = latestTest == null ? null : NormalizeObjectiveValue(latestTest.Value, def, benchmarkOverride);
        decimal? coachScore = latestCoach == null ? null : Math.Clamp(Math.Round(latestCoach.Rating, 1), 1m, 10m);
        decimal? selfScore = latestSelf == null ? null : Math.Clamp(Math.Round(latestSelf.Rating, 1), 1m, 10m);

        var hasObj = objScore != null;
        var hasMatch = matchScore != null;
        var hasCoach = coachScore != null;
        var hasSelf = selfScore != null;
        if (!hasObj && !hasMatch && !hasCoach && !hasSelf) return null;

        var (wObj, wMatch, wCoach, wSelf) = RedistributeWeights(def, hasObj, hasMatch, hasCoach, hasSelf);
        var final = (objScore ?? 0) * wObj + (matchScore ?? 0) * wMatch
                  + (coachScore ?? 0) * wCoach + (selfScore ?? 0) * wSelf;
        final = Math.Clamp(Math.Round(final, 1), 1m, 10m);

        var confidence = GetConfidenceLevel(hasObj, hasMatch, hasCoach, hasSelf, def.IsObjectiveRequired);
        var method = GetCalculationMethod(hasObj, hasMatch, hasCoach, hasSelf);

        var sources = new List<string>();
        if (latestTest != null)
            sources.Add($"{def.Name} test ({latestTest.Value:0.##} {latestTest.Unit})".Trim());
        if (hasMatch)
            sources.Add($"{matchEntries.Count} match stat {(matchEntries.Count == 1 ? "entry" : "entries")}");
        if (hasCoach) sources.Add("coach evaluation");
        if (hasSelf) sources.Add("self-assessment");

        var explanation = BuildExplanation(def, final, confidence,
            latestTest, objScore, matchScore, matchEntries.Count, coachScore, selfScore,
            MissingEvidence(def, hasObj, hasMatch, hasCoach, hasSelf));

        return new EvidenceBasedScore
        {
            PlayerId = playerId,
            MetricDefinitionId = def.Id,
            AssessmentId = assessmentId,
            FinalScore = final,
            Confidence = confidence,
            CalculationMethod = method,
            ObjectiveScore = objScore,
            MatchStatScore = matchScore,
            CoachEvalScore = coachScore,
            SelfAssessScore = selfScore,
            ObjectiveWeight = Math.Round(wObj, 3),
            MatchStatWeight = Math.Round(wMatch, 3),
            CoachEvalWeight = Math.Round(wCoach, 3),
            SelfAssessWeight = Math.Round(wSelf, 3),
            EvidenceSources = JsonSerializer.Serialize(sources),
            Explanation = explanation,
            LastCalculatedAt = DateTime.UtcNow,
        };
    }

    // Which of the definition's weighted sources have no data yet — phrased as what to add.
    public static List<string> MissingEvidence(SportMetricDefinition def,
        bool hasObjective, bool hasMatch, bool hasCoach, bool hasSelf)
    {
        var missing = new List<string>();
        if (!hasObjective && def.ObjectiveTestWeight > 0)
            missing.Add($"objective test{(def.Unit != null ? $" ({def.Unit})" : "")}");
        if (!hasMatch && def.MatchStatWeight > 0 && MatchStatRules.ContainsKey((def.SportId, def.Name)))
            missing.Add("match stats");
        if (!hasCoach && def.CoachEvalWeight > 0) missing.Add("coach evaluation");
        if (!hasSelf && def.SelfAssessWeight > 0) missing.Add("self-assessment");
        return missing;
    }

    private static string BuildExplanation(SportMetricDefinition def, decimal final, EvidenceConfidence confidence,
        ObjectiveTestResult? test, decimal? objScore, decimal? matchScore, int matchCount,
        decimal? coachScore, decimal? selfScore, List<string> missing)
    {
        var parts = new List<string>();
        if (test != null && objScore != null)
            parts.Add($"a measured {def.Name.ToLowerInvariant()} test of {test.Value:0.##} {test.Unit} (scores {objScore:0.0}/10)".Trim());
        if (matchScore != null)
            parts.Add($"statistics from {matchCount} match{(matchCount == 1 ? "" : "es")} (scores {matchScore:0.0}/10)");
        if (coachScore != null)
            parts.Add($"a coach evaluation of {coachScore:0.0}/10");
        if (selfScore != null)
            parts.Add($"a self-assessment of {selfScore:0.0}/10");

        var text = $"{def.Name} score is {final:0.0} based on {string.Join(", ", parts)}.";
        if (missing.Count > 0 && confidence != EvidenceConfidence.VeryHigh)
        {
            var next = confidence switch
            {
                EvidenceConfidence.Low => "Medium",
                EvidenceConfidence.Medium => "High",
                _ => "Very High",
            };
            text += $" Adding {missing[0]} data would raise confidence toward {next}.";
        }
        return text;
    }

    // One "current" row per player+metric (AssessmentId null); assessment-linked snapshots
    // get their own row per assessment.
    private async Task UpsertAsync(EvidenceBasedScore score)
    {
        var existing = await _context.EvidenceBasedScores.FirstOrDefaultAsync(s =>
            s.PlayerId == score.PlayerId
            && s.MetricDefinitionId == score.MetricDefinitionId
            && s.AssessmentId == score.AssessmentId);

        if (existing == null)
        {
            _context.EvidenceBasedScores.Add(score);
            return;
        }

        existing.FinalScore = score.FinalScore;
        existing.Confidence = score.Confidence;
        existing.CalculationMethod = score.CalculationMethod;
        existing.ObjectiveScore = score.ObjectiveScore;
        existing.MatchStatScore = score.MatchStatScore;
        existing.CoachEvalScore = score.CoachEvalScore;
        existing.SelfAssessScore = score.SelfAssessScore;
        existing.ObjectiveWeight = score.ObjectiveWeight;
        existing.MatchStatWeight = score.MatchStatWeight;
        existing.CoachEvalWeight = score.CoachEvalWeight;
        existing.SelfAssessWeight = score.SelfAssessWeight;
        existing.EvidenceSources = score.EvidenceSources;
        existing.Explanation = score.Explanation;
        existing.LastCalculatedAt = score.LastCalculatedAt;
        // Callers get the up-to-date row back (with the persisted Id).
        score.Id = existing.Id;
        score.CreatedAt = existing.CreatedAt;
    }
}
