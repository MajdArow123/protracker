using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public enum EvidenceConfidence
{
    Low,
    Medium,
    High,
    VeryHigh
}

public enum ScoreCalculationMethod
{
    Manual,     // only coach-eval evidence (i.e. equivalent to a slider score)
    Calculated, // objective/match data only, no subjective input
    Hybrid      // a mix of measured and subjective evidence
}

// The calculated evidence-based score for one player+metric, with the full breakdown of
// which sources contributed and at what weight. One "current" row per player+metric
// (AssessmentId null) is upserted on every recalculation; assessment-linked snapshots
// keep their own rows. Produced exclusively by EvidenceScoringEngine.
public class EvidenceBasedScore
{
    public int Id { get; set; }

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    // Phase 10 benchmark provenance (S1b): SNAPSHOT of the benchmark profile in effect
    // when this row was produced — Team.BenchmarkProfileId is mutable with no history,
    // so this column is what enforces the ruling that scores stay calibrated against
    // the profile in effect at the time. Nothing populates it yet; wiring is S3.
    public int? BenchmarkProfileId { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int MetricDefinitionId { get; set; }
    public SportMetricDefinition MetricDefinition { get; set; } = null!;

    public int? AssessmentId { get; set; }
    public PlayerAssessment? Assessment { get; set; }

    [Column(TypeName = "decimal(3,1)")]
    public decimal FinalScore { get; set; }

    public EvidenceConfidence Confidence { get; set; } = EvidenceConfidence.Low;

    public ScoreCalculationMethod CalculationMethod { get; set; } = ScoreCalculationMethod.Manual;

    // Per-source normalized 1-10 scores; null when that source had no data in the window.
    [Column(TypeName = "decimal(3,1)")]
    public decimal? ObjectiveScore { get; set; }

    [Column(TypeName = "decimal(3,1)")]
    public decimal? MatchStatScore { get; set; }

    [Column(TypeName = "decimal(3,1)")]
    public decimal? CoachEvalScore { get; set; }

    [Column(TypeName = "decimal(3,1)")]
    public decimal? SelfAssessScore { get; set; }

    // The actual weights used after redistributing missing sources (sum to 1, or 0 if unused).
    [Column(TypeName = "decimal(4,3)")]
    public decimal ObjectiveWeight { get; set; }

    [Column(TypeName = "decimal(4,3)")]
    public decimal MatchStatWeight { get; set; }

    [Column(TypeName = "decimal(4,3)")]
    public decimal CoachEvalWeight { get; set; }

    [Column(TypeName = "decimal(4,3)")]
    public decimal SelfAssessWeight { get; set; }

    // JSON array of human-readable evidence source descriptions,
    // e.g. ["30m Sprint test (4.1 seconds)", "3 match stat entries", "coach evaluation"].
    public string EvidenceSources { get; set; } = "[]";

    // Plain-English explanation of how the score came about and what's missing.
    public string? Explanation { get; set; }

    // When the objective test contributing to this score was taken (null = none in
    // window). Confidence-freshness fields (expired / days since / next due) derive
    // from this at read time.
    public DateTime? LastObjectiveTestAt { get; set; }

    public DateTime LastCalculatedAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
