using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum TaskPriority
{
    Low,
    Medium,
    High
}

public enum TaskCategory
{
    Training,
    Nutrition,
    Recovery,
    Tactical,
    Physical,
    Other
}

// A task/drill a coach assigns to a specific player. Distinct from the legacy TaskItem,
// which is a sub-item of a TrainingPlan and unrelated to player assignment.
public class PlayerTask
{
    public int Id { get; set; }

    // ApplicationUser Id (string) of the coach who created the task.
    public string CoachId { get; set; } = "";

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    [Required]
    public string Title { get; set; } = "";

    public string? Description { get; set; }

    public DateTime? DueDate { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public TaskCategory Category { get; set; } = TaskCategory.Training;

    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }

    // The athlete's optional note left when marking the task complete.
    public string? CompletedNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
