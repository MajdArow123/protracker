using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// A built-in, reusable recovery program keyed to a common injury type (e.g. "Hamstring
// Strain"). Coaches can apply a template to an injury as an alternative to AI generation or
// building a plan from scratch — it materialises into an InjuryRecoveryPlan (a copy the coach
// can then edit per athlete). Seeded as reference data at startup (RecoveryTemplateSeeder).
public class RecoveryTemplate
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";
    public string BodyPart { get; set; } = "";
    public string? Description { get; set; }
    public int EstimatedWeeks { get; set; }
    // The severity this template is typically appropriate for (guidance only).
    public InjurySeverity TypicalSeverity { get; set; } = InjurySeverity.Moderate;

    public List<RecoveryTemplateExercise> Exercises { get; set; } = new();
    public List<RecoveryTemplateMilestone> Milestones { get; set; } = new();
}

public class RecoveryTemplateExercise
{
    public int Id { get; set; }

    public int RecoveryTemplateId { get; set; }
    public RecoveryTemplate RecoveryTemplate { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int? Sets { get; set; }
    public int? Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public int Week { get; set; }
    public string DayOfWeek { get; set; } = "All";
    public RecoveryExerciseCategory Category { get; set; } = RecoveryExerciseCategory.Mobility;
}

public class RecoveryTemplateMilestone
{
    public int Id { get; set; }

    public int RecoveryTemplateId { get; set; }
    public RecoveryTemplate RecoveryTemplate { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";
    public int TargetWeek { get; set; }
}
