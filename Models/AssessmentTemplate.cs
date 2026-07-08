using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

// A reusable assessment configuration a coach saves to speed up future assessments. Sport-
// specific: the template's scores map to that sport's stat categories.
public class AssessmentTemplate
{
    public int Id { get; set; }

    // ApplicationUser Id of the coach who owns this template.
    public string CoachId { get; set; } = "";

    [Required]
    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    public string? DefaultNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<AssessmentTemplateScore> Scores { get; set; } = new();
}

// A per-category entry in a template: an optional pre-filled score, an optional weight for a
// weighted average, and whether the category must be scored.
public class AssessmentTemplateScore
{
    public int Id { get; set; }

    public int AssessmentTemplateId { get; set; }
    public AssessmentTemplate AssessmentTemplate { get; set; } = null!;

    public int SportStatCategoryId { get; set; }

    [Column(TypeName = "decimal(3,1)")]
    public decimal? DefaultScore { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? Weight { get; set; }

    public bool IsRequired { get; set; }
}
