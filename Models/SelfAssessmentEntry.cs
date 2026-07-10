using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

// An athlete's own 1-10 rating of a single metric, optionally backed by answers to
// sport-specific guided questions. The lowest-weight evidence source; also what a solo
// athlete's slider self-assessments are captured as.
public class SelfAssessmentEntry
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int MetricDefinitionId { get; set; }
    public SportMetricDefinition MetricDefinition { get; set; } = null!;

    [Range(1, 10)]
    [Column(TypeName = "decimal(3,1)")]
    public decimal Rating { get; set; }

    public DateTime EvalDate { get; set; } = DateTime.UtcNow;

    // JSON of { question, answer, value } entries when the rating came from guided questions.
    public string? GuidedAnswers { get; set; }

    public string? Notes { get; set; }

    public int? AssessmentId { get; set; }
    public PlayerAssessment? Assessment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
