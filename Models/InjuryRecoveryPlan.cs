using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum RecoveryPlanStatus
{
    Active,
    Completed,
    Paused
}

public enum RecoveryExerciseCategory
{
    Mobility,
    Strength,
    Cardio,
    Flexibility,
    Balance,
    Ice,
    Heat,
    Rest
}

// A structured, week-by-week rehab program a coach assigns for a specific injury.
// Recovery exercises are sport/position/severity-aware (the AI generator is given all
// of that context), so a volleyball shoulder program differs from a soccer hamstring one.
public class InjuryRecoveryPlan
{
    public int Id { get; set; }

    public int InjuryRecordId { get; set; }
    public InjuryRecord InjuryRecord { get; set; } = null!;

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public string CoachId { get; set; } = "";

    [Required]
    public string Title { get; set; } = "";

    public int EstimatedWeeks { get; set; }
    public int CurrentWeek { get; set; } = 1;

    public RecoveryPlanStatus Status { get; set; } = RecoveryPlanStatus.Active;

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<RecoveryExercise> Exercises { get; set; } = new();
    public List<RecoveryMilestone> Milestones { get; set; } = new();
}

public class RecoveryExercise
{
    public int Id { get; set; }

    public int InjuryRecoveryPlanId { get; set; }
    public InjuryRecoveryPlan InjuryRecoveryPlan { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";
    public string? Description { get; set; }

    public int? Sets { get; set; }
    public int? Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }

    public int Week { get; set; }
    // Mon/Tue/.../Sun or "All".
    public string DayOfWeek { get; set; } = "All";

    public RecoveryExerciseCategory Category { get; set; } = RecoveryExerciseCategory.Mobility;

    // Athlete completion tracking.
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CompletedNote { get; set; }
    public int? DifficultyRating { get; set; } // 1-5
}

public class RecoveryMilestone
{
    public int Id { get; set; }

    public int InjuryRecoveryPlanId { get; set; }
    public InjuryRecoveryPlan InjuryRecoveryPlan { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";
    public int TargetWeek { get; set; }

    public bool IsAchieved { get; set; }
    public DateTime? AchievedAt { get; set; }
    public string? Notes { get; set; }
}
