using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public enum MetricCategory
{
    Physical,
    Technical,
    Tactical,
    Mental,
    Positional
}

// What kind of value the metric's objective test records (drives the input UI + unit label).
public enum MetricInputType
{
    Timer,       // seconds / ms — lower is usually better
    Weight,      // kg
    Distance,    // cm / meters / km
    Percentage,  // 0-100
    Count,       // repetitions / touches / makes
    Rating,      // already on the 1-10 scale (no benchmark normalization)
    Boolean      // pass / fail
}

// Reference data: one row per measurable metric per sport (e.g. Soccer "Speed").
// Defines how the four evidence sources are weighted and how raw objective test
// values map onto the app-wide 1-10 scale (see EvidenceScoringEngine).
// Seeded by Data/MetricDefinitionSeeder.cs.
public class SportMetricDefinition
{
    public int Id { get; set; }

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    [Required]
    public string Name { get; set; } = "";

    public string? ShortName { get; set; }

    public MetricCategory Category { get; set; } = MetricCategory.Technical;

    public string? Description { get; set; }

    // Unit of the objective test value ("seconds", "cm", "%", "count"...). Null for
    // Rating-type metrics that have no physical test.
    public string? Unit { get; set; }

    public MetricInputType InputType { get; set; } = MetricInputType.Rating;

    // Relative weights of the four evidence sources (0-1 each). When a source has no
    // data, its weight is redistributed proportionally across the present sources.
    [Column(TypeName = "decimal(3,2)")]
    public decimal ObjectiveTestWeight { get; set; } = 0.4m;

    [Column(TypeName = "decimal(3,2)")]
    public decimal MatchStatWeight { get; set; } = 0.3m;

    [Column(TypeName = "decimal(3,2)")]
    public decimal CoachEvalWeight { get; set; } = 0.2m;

    [Column(TypeName = "decimal(3,2)")]
    public decimal SelfAssessWeight { get; set; } = 0.1m;

    // When true, confidence stays Low until an objective test result exists
    // (pure physical metrics like sprint times or jump height).
    public bool IsObjectiveRequired { get; set; }

    // Anchor points mapping a raw objective test value onto the 1-10 scale:
    // value at BenchmarkLow scores 3, BenchmarkMid scores 5, BenchmarkHigh scores 10.
    // For "lower is better" tests (sprint seconds) Low > High — the interpolation
    // handles either direction. Meaningless for Rating-type metrics.
    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkLow { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkMid { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkHigh { get; set; }

    // How to run the objective test (shown as a hint in the entry UI).
    public string? Notes { get; set; }

    // ── Test protocol guide (Phase G accuracy round) ─────────────────────────
    // Equipment needed, space required, setup instructions.
    public string? TestSetup { get; set; }

    // Step-by-step instructions, one numbered step per line ("1. ...\n2. ...").
    public string? TestProcedure { get; set; }

    // What to avoid for an accurate, comparable measurement.
    public string? CommonMistakes { get; set; }

    // Optional demo video link.
    public string? VideoUrl { get; set; }

    // The existing slider stat category this metric corresponds to, when one exists.
    // Slider assessments auto-create CoachEvaluation/SelfAssessmentEntry evidence for
    // metrics linked this way, so every historical assessment already counts as evidence.
    public int? SportStatCategoryId { get; set; }
    public SportStatCategory? SportStatCategory { get; set; }
}
