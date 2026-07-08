using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public enum GoalCategory
{
    Performance,
    Fitness,
    Nutrition,
    Mental,
    Technical,
    Tactical,
    Other
}

public enum GoalStatus
{
    Active,
    Achieved,
    Paused,
    Abandoned
}

public enum GoalPriority
{
    High,
    Medium,
    Low
}

public enum GoalProgressSource
{
    Manual,
    Assessment,
    Match,
    Auto
}

// A personal goal owned by a single player (athlete, solo athlete, or a coach-created goal
// for a managed athlete). Works for both team athletes and solo athletes. Progress can be
// tracked manually or auto-linked from assessments (see LinkedStatCategoryId).
public class PersonalGoal
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // ApplicationUser Id of the athlete who owns this goal (null for coach-managed players
    // without an account). Set from Player.UserId at creation time.
    public string? UserId { get; set; }

    [Required]
    public string Title { get; set; } = "";

    public string? Description { get; set; }

    public GoalCategory Category { get; set; } = GoalCategory.Performance;

    // Optional measurable target, e.g. TargetValue=8.0 Unit="score", or 25 Unit="min".
    [Column(TypeName = "decimal(9,2)")]
    public decimal? TargetValue { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal? CurrentValue { get; set; }

    public string? Unit { get; set; }

    // Optional assessment stat category this goal tracks. When set, saving an assessment
    // auto-logs a GoalProgress entry and updates CurrentValue.
    public int? LinkedStatCategoryId { get; set; }

    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? TargetDate { get; set; }

    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public GoalPriority Priority { get; set; } = GoalPriority.Medium;

    // Athlete-only goals a coach can never see.
    public bool IsPrivate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? AchievedAt { get; set; }

    public List<GoalMilestone> Milestones { get; set; } = new();
    public List<GoalProgress> ProgressEntries { get; set; } = new();
}

// A checkpoint along the way to a goal, e.g. "Reach 7.0 passing score".
public class GoalMilestone
{
    public int Id { get; set; }

    public int PersonalGoalId { get; set; }
    public PersonalGoal PersonalGoal { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";

    [Column(TypeName = "decimal(9,2)")]
    public decimal? TargetValue { get; set; }

    public bool IsAchieved { get; set; }
    public DateTime? AchievedAt { get; set; }
    public DateTime? TargetDate { get; set; }
}

// A single recorded progress data point for a goal (manual log or auto from an assessment).
public class GoalProgress
{
    public int Id { get; set; }

    public int PersonalGoalId { get; set; }
    public PersonalGoal PersonalGoal { get; set; } = null!;

    [Column(TypeName = "decimal(9,2)")]
    public decimal Value { get; set; }

    public string? Note { get; set; }

    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    public GoalProgressSource Source { get; set; } = GoalProgressSource.Manual;
}
