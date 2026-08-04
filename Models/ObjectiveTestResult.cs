using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public enum TestedByType
{
    Coach,
    Athlete,
    ThirdParty
}

// A real measured physical/technical test result (sprint time, jump height, accuracy %...)
// — the strongest evidence source feeding EvidenceScoringEngine.
public class ObjectiveTestResult
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

    // The raw measurement, in Unit (normalized to 1-10 via the definition's benchmarks).
    [Column(TypeName = "decimal(9,2)")]
    public decimal Value { get; set; }

    public string Unit { get; set; } = "";

    public DateTime TestedAt { get; set; } = DateTime.UtcNow;

    public TestedByType TestedBy { get; set; } = TestedByType.Coach;

    public string? Notes { get; set; }

    // Optional link back to the assessment the coach was filling in when this was recorded.
    public int? AssessmentId { get; set; }
    public PlayerAssessment? Assessment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
