using ProTracker.Models;

namespace ProTracker.Dtos;

public class PlayerTaskDto
{
    public int Id { get; set; }
    public string CoachId { get; set; } = "";
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateTime? DueDate { get; set; }
    public TaskPriority Priority { get; set; }
    public TaskCategory Category { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CompletedNote { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreatePlayerTaskDto
{
    public int PlayerId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateTime? DueDate { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public TaskCategory Category { get; set; } = TaskCategory.Training;
}

public class CompleteTaskDto
{
    public string? CompletedNote { get; set; }
}

public class PlayerTaskStatsDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int Total { get; set; }
    public int Completed { get; set; }
    public int Overdue { get; set; }
    public double CompletionRate { get; set; } // 0-100
}

public class TaskCategoryStatsDto
{
    public TaskCategory Category { get; set; }
    public int Total { get; set; }
    public int Completed { get; set; }
    public double CompletionRate { get; set; } // 0-100
}

public class WeeklyTaskTrendDto
{
    public DateTime WeekStart { get; set; }
    public string WeekLabel { get; set; } = "";
    public int Assigned { get; set; }
    public int Completed { get; set; }
}

public class TaskAnalyticsDto
{
    public int Total { get; set; }
    public int Completed { get; set; }
    public int Pending { get; set; }
    public int Overdue { get; set; }
    public double CompletionRate { get; set; } // 0-100
    public double? AvgDaysToComplete { get; set; }
    public List<PlayerTaskStatsDto> PlayerStats { get; set; } = new();
    public List<TaskCategoryStatsDto> CategoryStats { get; set; } = new();
    public List<WeeklyTaskTrendDto> WeeklyTrend { get; set; } = new();
    public PlayerTaskStatsDto? TopPerformer { get; set; }
    public PlayerTaskStatsDto? NeedsAttention { get; set; }
}
