namespace ProTracker.Dtos;

// ─── Metric definitions ──────────────────────────────────────────────────────

public class SportMetricDefinitionDto
{
    public int Id { get; set; }
    public int SportId { get; set; }
    public string Name { get; set; } = "";
    public string? ShortName { get; set; }
    public string Category { get; set; } = "";
    public string? Description { get; set; }
    public string? Unit { get; set; }
    public string InputType { get; set; } = "";
    public decimal ObjectiveTestWeight { get; set; }
    public decimal MatchStatWeight { get; set; }
    public decimal CoachEvalWeight { get; set; }
    public decimal SelfAssessWeight { get; set; }
    public bool IsObjectiveRequired { get; set; }
    public decimal BenchmarkLow { get; set; }
    public decimal BenchmarkMid { get; set; }
    public decimal BenchmarkHigh { get; set; }
    public string? Notes { get; set; }
    public int? SportStatCategoryId { get; set; }
    // Whether match stats can contribute to this metric (a mapping rule exists).
    public bool SupportsMatchStats { get; set; }
    // Test protocol guide.
    public string? TestSetup { get; set; }
    public string? TestProcedure { get; set; }
    public string? CommonMistakes { get; set; }
    public string? VideoUrl { get; set; }
}

// ─── Objective tests ─────────────────────────────────────────────────────────

public class CreateObjectiveTestDto
{
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public decimal Value { get; set; }
    public string? Unit { get; set; }
    public DateTime? TestedAt { get; set; }
    public string? Notes { get; set; }
    public int? AssessmentId { get; set; }
}

public class ObjectiveTestResultDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public string MetricName { get; set; } = "";
    public decimal Value { get; set; }
    public string Unit { get; set; } = "";
    public DateTime TestedAt { get; set; }
    public string TestedBy { get; set; } = "";
    public string? Notes { get; set; }
    public int? AssessmentId { get; set; }
    // The 1-10 score this raw value normalizes to via the metric's benchmarks.
    public decimal NormalizedScore { get; set; }
}

// ─── Match stats ─────────────────────────────────────────────────────────────

public class CreateMatchStatDto
{
    public int PlayerId { get; set; }
    public DateTime? StatDate { get; set; }
    // Flat numeric stats object, keys per sport (see MatchStatEntry).
    public Dictionary<string, decimal> Stats { get; set; } = new();
    public int? MatchResultId { get; set; }
    public string? Notes { get; set; }
}

public class MatchStatEntryDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int? MatchResultId { get; set; }
    public DateTime StatDate { get; set; }
    public int SportId { get; set; }
    public Dictionary<string, decimal> Stats { get; set; } = new();
    public string? Notes { get; set; }
    public bool IsAutoImported { get; set; }
}

// ─── Coach evaluations & self-assessments ────────────────────────────────────

public class CreateCoachEvaluationDto
{
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public decimal Rating { get; set; }
    public DateTime? EvalDate { get; set; }
    public string? Notes { get; set; }
    public int? AssessmentId { get; set; }
}

public class CoachEvaluationDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public string MetricName { get; set; } = "";
    public decimal Rating { get; set; }
    public DateTime EvalDate { get; set; }
    public string? Notes { get; set; }
    public int? AssessmentId { get; set; }
}

public class CreateSelfAssessmentDto
{
    public int MetricDefinitionId { get; set; }
    public decimal Rating { get; set; }
    public DateTime? EvalDate { get; set; }
    // JSON of { question, answer, value } entries from the guided questions UI.
    public string? GuidedAnswers { get; set; }
    public string? Notes { get; set; }
    public int? AssessmentId { get; set; }
}

public class SelfAssessmentEntryDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public string MetricName { get; set; } = "";
    public decimal Rating { get; set; }
    public DateTime EvalDate { get; set; }
    public string? GuidedAnswers { get; set; }
    public string? Notes { get; set; }
}

// ─── Evidence-based scores ───────────────────────────────────────────────────

public class EvidenceBasedScoreDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int MetricDefinitionId { get; set; }
    public string MetricName { get; set; } = "";
    public string MetricCategory { get; set; } = "";
    public int? SportStatCategoryId { get; set; }
    public int? AssessmentId { get; set; }
    public decimal FinalScore { get; set; }
    public string Confidence { get; set; } = "";
    public string CalculationMethod { get; set; } = "";
    public decimal? ObjectiveScore { get; set; }
    public decimal? MatchStatScore { get; set; }
    public decimal? CoachEvalScore { get; set; }
    public decimal? SelfAssessScore { get; set; }
    public decimal ObjectiveWeight { get; set; }
    public decimal MatchStatWeight { get; set; }
    public decimal CoachEvalWeight { get; set; }
    public decimal SelfAssessWeight { get; set; }
    public List<string> EvidenceSources { get; set; } = new();
    public string? Explanation { get; set; }
    public List<string> MissingEvidence { get; set; } = new();
    public DateTime LastCalculatedAt { get; set; }

    // Objective-test freshness (High confidence requires a test in the last 60 days).
    // Whether the metric can be objectively tested at all (rating-only metrics can't).
    public bool IsObjectiveTestable { get; set; }
    public bool IsObjectiveTestExpired { get; set; }
    public int? DaysSinceObjectiveTest { get; set; }
    public DateTime? NextObjectiveTestDue { get; set; }
}

// ─── Team evidence status (Phase G Section 4) ────────────────────────────────

public class PlayerEvidenceStatusDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int? JerseyNumber { get; set; }
    public int ScoredMetrics { get; set; }
    public int VerifiedMetrics { get; set; }
    // Most common confidence across the player's scores; null with no evidence.
    public string? OverallConfidence { get; set; }
    public DateTime? LastTestAt { get; set; }
    public int TestCount { get; set; }
    public int MatchStatCount { get; set; }
}

public class TeamEvidenceStatusDto
{
    public int TeamId { get; set; }
    public int TotalMetrics { get; set; }
    public List<PlayerEvidenceStatusDto> Players { get; set; } = new();
    // Players with no objective test in the last 30 days.
    public int PlayersNeedingTests { get; set; }
    public int PlayersWithoutMatchStats { get; set; }
    public int PlayersWithoutEvidence { get; set; }
}

// ─── Evidence reminders (Phase G Section 5) ──────────────────────────────────

// One reminder item; the frontend composes the localized message.
// Type: NoRecentTest (per player, stale/missing objective tests) or
// LowConfidence (aggregate: players whose scores are mostly estimates).
public class EvidenceReminderDto
{
    public string Type { get; set; } = "";
    public int? PlayerId { get; set; }
    public string? PlayerName { get; set; }
    public string? TeamName { get; set; }
    public int? TeamId { get; set; }
    // NoRecentTest: days since the last test (null = never tested).
    public int? DaysSinceTest { get; set; }
    // LowConfidence: how many players are affected.
    public int? Count { get; set; }
}

// ─── Team performance analytics (Phase G continuation, Section 6) ────────────

public class TeamMetricOutlierDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public decimal Score { get; set; }
}

public class TeamBandCountsDto
{
    public int Red { get; set; }
    public int Amber { get; set; }
    public int Green { get; set; }
}

public class TeamMetricPerformanceDto
{
    public int MetricDefinitionId { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string? Unit { get; set; }
    // Coverage denominators — every stat below is only as good as these.
    public int ScoredCount { get; set; }
    public int VerifiedCount { get; set; }
    public decimal? Average { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }
    // Sample (n-1) standard deviation; null below TeamPerformanceMath.MinScoredForStdDev.
    public decimal? StdDev { get; set; }
    public TeamBandCountsDto BandCounts { get; set; } = new();
    // Players whose blended FinalScore < 5.0. Deliberately "below average (score < 5)",
    // NOT "below benchmark": the blend mixes anchor-calibrated components (objective,
    // match stats) with raw 1-10 subjective ratings (coach eval, self-assessment), so
    // 5.0 is the app scale's average, not the cohort Average anchor.
    public int BelowAverageCount { get; set; }
    public List<TeamMetricOutlierDto> LowOutliers { get; set; } = new();
    public List<TeamMetricOutlierDto> HighOutliers { get; set; } = new();
}

public class TeamEvidencePerformanceDto
{
    public int TeamId { get; set; }
    public int SquadSize { get; set; }
    public int? BenchmarkProfileId { get; set; }
    public string? ProfileName { get; set; }
    public List<TeamMetricPerformanceDto> Metrics { get; set; } = new();
}
