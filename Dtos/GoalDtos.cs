using ProTracker.Models;

namespace ProTracker.Dtos;

public class PersonalGoalDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public GoalCategory Category { get; set; }
    public decimal? TargetValue { get; set; }
    public decimal? CurrentValue { get; set; }
    public string? Unit { get; set; }
    public int? LinkedStatCategoryId { get; set; }
    public string? LinkedStatCategoryName { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? TargetDate { get; set; }
    public GoalStatus Status { get; set; }
    public GoalPriority Priority { get; set; }
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? AchievedAt { get; set; }
    // 0-100 completion toward the target (or null when there's no measurable target).
    public double? ProgressPercent { get; set; }
    public List<GoalMilestoneDto> Milestones { get; set; } = new();
}

public class GoalMilestoneDto
{
    public int Id { get; set; }
    public int PersonalGoalId { get; set; }
    public string Title { get; set; } = "";
    public decimal? TargetValue { get; set; }
    public bool IsAchieved { get; set; }
    public DateTime? AchievedAt { get; set; }
    public DateTime? TargetDate { get; set; }
}

public class GoalProgressDto
{
    public int Id { get; set; }
    public int PersonalGoalId { get; set; }
    public decimal Value { get; set; }
    public string? Note { get; set; }
    public DateTime RecordedAt { get; set; }
    public GoalProgressSource Source { get; set; }
}

public class CreateGoalMilestoneDto
{
    public string Title { get; set; } = "";
    public decimal? TargetValue { get; set; }
    public DateTime? TargetDate { get; set; }
}

public class CreateGoalDto
{
    // Whose goal. Athletes/solo pass their own player id; coaches pass a player they scope.
    public int PlayerId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public GoalCategory Category { get; set; } = GoalCategory.Performance;
    public decimal? TargetValue { get; set; }
    public decimal? CurrentValue { get; set; }
    public string? Unit { get; set; }
    public int? LinkedStatCategoryId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? TargetDate { get; set; }
    public GoalPriority Priority { get; set; } = GoalPriority.Medium;
    public bool IsPrivate { get; set; }
    // Optional milestones created alongside the goal.
    public List<CreateGoalMilestoneDto> Milestones { get; set; } = new();
}

public class UpdateGoalDto
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public GoalCategory Category { get; set; } = GoalCategory.Performance;
    public decimal? TargetValue { get; set; }
    public decimal? CurrentValue { get; set; }
    public string? Unit { get; set; }
    public int? LinkedStatCategoryId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? TargetDate { get; set; }
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public GoalPriority Priority { get; set; } = GoalPriority.Medium;
    public bool IsPrivate { get; set; }
}

public class LogGoalProgressDto
{
    public decimal Value { get; set; }
    public string? Note { get; set; }
    public DateTime? RecordedAt { get; set; }
}

// ─── AI goal suggestions ──────────────────────────────────────────────────────

public class GoalSuggestionDto
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public GoalCategory Category { get; set; }
    public decimal? TargetValue { get; set; }
    public decimal? CurrentValue { get; set; }
    public string? Unit { get; set; }
    public int? LinkedStatCategoryId { get; set; }
    // Suggested timeline in weeks (drives a suggested TargetDate on the client).
    public int? TimelineWeeks { get; set; }
    public string? FocusArea { get; set; }
}

public class GoalSuggestionsDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public List<string> WeakAreas { get; set; } = new();
    public List<GoalSuggestionDto> Suggestions { get; set; } = new();
}

// One row in the coach dashboard "Player Goals" overview card (non-private goals only).
public class CoachGoalOverviewRowDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int ActiveGoals { get; set; }
    public int AchievedGoals { get; set; }
    // Average completion (0-100) across the player's active goals.
    public double? AvgProgress { get; set; }
}

public class CoachGoalOverviewDto
{
    public List<CoachGoalOverviewRowDto> Players { get; set; } = new();
    public int TotalActiveGoals { get; set; }
    public int PlayersWithGoals { get; set; }
}
