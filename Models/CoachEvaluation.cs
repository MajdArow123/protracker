using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

// A coach's structured 1-10 rating of a single metric. Auto-created from every slider
// assessment a coach saves (so all historical assessments count as evidence), and can
// also be entered directly via guided evaluation questions.
public class CoachEvaluation
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // ApplicationUser id of the evaluating coach.
    [Required]
    public string CoachId { get; set; } = "";

    public int MetricDefinitionId { get; set; }
    public SportMetricDefinition MetricDefinition { get; set; } = null!;

    [Range(1, 10)]
    [Column(TypeName = "decimal(3,1)")]
    public decimal Rating { get; set; }

    public DateTime EvalDate { get; set; } = DateTime.UtcNow;

    public string? Notes { get; set; }

    // Set when this evaluation was derived from (or entered alongside) a slider assessment.
    public int? AssessmentId { get; set; }
    public PlayerAssessment? Assessment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
