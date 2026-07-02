using ProTracker.Models;

namespace ProTracker.Dtos;

public class RecoveryExerciseDto
{
    public int Id { get; set; }
    public int InjuryRecoveryPlanId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int? Sets { get; set; }
    public int? Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public int Week { get; set; }
    public string DayOfWeek { get; set; } = "All";
    public RecoveryExerciseCategory Category { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CompletedNote { get; set; }
    public int? DifficultyRating { get; set; }
}

public class RecoveryMilestoneDto
{
    public int Id { get; set; }
    public int InjuryRecoveryPlanId { get; set; }
    public string Title { get; set; } = "";
    public int TargetWeek { get; set; }
    public bool IsAchieved { get; set; }
    public DateTime? AchievedAt { get; set; }
    public string? Notes { get; set; }
}

public class RecoveryPlanDto
{
    public int Id { get; set; }
    public int InjuryRecordId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public string CoachId { get; set; } = "";
    public string Title { get; set; } = "";
    public int EstimatedWeeks { get; set; }
    public int CurrentWeek { get; set; }
    public RecoveryPlanStatus Status { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    // Enriched injury context for display.
    public string InjuryType { get; set; } = "";
    public string? BodyPart { get; set; }
    public InjurySeverity Severity { get; set; }
    public int CompletedExercises { get; set; }
    public int TotalExercises { get; set; }
    public List<RecoveryExerciseDto> Exercises { get; set; } = new();
    public List<RecoveryMilestoneDto> Milestones { get; set; } = new();
}

public class CreateRecoveryPlanDto
{
    public string Title { get; set; } = "";
    public int EstimatedWeeks { get; set; } = 4;
    public string? Notes { get; set; }
}

public class UpdateRecoveryPlanDto
{
    public string Title { get; set; } = "";
    public int EstimatedWeeks { get; set; }
    public int CurrentWeek { get; set; }
    public RecoveryPlanStatus Status { get; set; }
    public string? Notes { get; set; }
}

public class CreateRecoveryExerciseDto
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int? Sets { get; set; }
    public int? Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public int Week { get; set; } = 1;
    public string DayOfWeek { get; set; } = "All";
    public RecoveryExerciseCategory Category { get; set; } = RecoveryExerciseCategory.Mobility;
}

public class CompleteRecoveryExerciseDto
{
    public string? CompletedNote { get; set; }
    public int? DifficultyRating { get; set; }
}

public class CreateRecoveryMilestoneDto
{
    public string Title { get; set; } = "";
    public int TargetWeek { get; set; } = 1;
}

public class AchieveMilestoneDto
{
    public string? Notes { get; set; }
}
