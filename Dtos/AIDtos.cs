using ProTracker.Models;

namespace ProTracker.Dtos;

public class AIInsightsDto
{
    public List<string> Insights { get; set; } = new();
    public string GeneratedAt { get; set; } = DateTime.UtcNow.ToString("o");
}

// A single AI-suggested task the coach can assign with one click. Shapes onto
// CreatePlayerTaskDto (title/description/priority/category); FocusArea/Rationale explain
// why the AI picked it (which weak assessment area it targets).
public class TaskSuggestionDto
{
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public TaskCategory Category { get; set; } = TaskCategory.Training;
    public string? FocusArea { get; set; }
    public string? Rationale { get; set; }
}

public class TaskSuggestionsDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    // The weakest assessment categories the suggestions are built around (e.g. "Passing: 4.0/10").
    public List<string> WeakAreas { get; set; } = new();
    public List<TaskSuggestionDto> Suggestions { get; set; } = new();
    public string GeneratedAt { get; set; } = DateTime.UtcNow.ToString("o");
}
