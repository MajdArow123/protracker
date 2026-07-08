using ProTracker.Models;

namespace ProTracker.Dtos;

// Generic paged envelope (drills paginate 20/page).
public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class DrillDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public List<int> SportIds { get; set; } = new();
    public List<string> SportNames { get; set; } = new();
    public DrillCategory Category { get; set; }
    public DrillDifficulty Difficulty { get; set; }
    public int? DurationMinutes { get; set; }
    public string? Equipment { get; set; }
    public string? Instructions { get; set; }
    public string? VideoUrl { get; set; }
    public List<string> TargetStatCategories { get; set; } = new();
    public bool IsBuiltIn { get; set; }
    public bool IsCustom { get; set; }        // created by the current user
    public bool IsFavorited { get; set; }
    public DateTime CreatedAt { get; set; }
    // Populated by the stats endpoint / analytics only (null in list responses).
    public DrillUsageDto? Usage { get; set; }
}

public class CreateDrillDto
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public List<int> SportIds { get; set; } = new();
    public DrillCategory Category { get; set; } = DrillCategory.Technical;
    public DrillDifficulty Difficulty { get; set; } = DrillDifficulty.Beginner;
    public int? DurationMinutes { get; set; }
    public string? Equipment { get; set; }
    public string? Instructions { get; set; }
    public string? VideoUrl { get; set; }
    public List<string> TargetStatCategories { get; set; } = new();
}

public class AssignDrillDto
{
    public int PlayerId { get; set; }
    public DateTime? DueDate { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public string? Note { get; set; }
}

// ─── Stats & analytics (Section 4 populates these; declared here to keep drill DTOs together) ──

public class DrillUsageDto
{
    public int TimesAssigned { get; set; }
    public int TimesCompleted { get; set; }
    public double CompletionRate { get; set; } // 0-100
    public int PlayerCount { get; set; }
}
