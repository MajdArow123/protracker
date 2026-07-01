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
