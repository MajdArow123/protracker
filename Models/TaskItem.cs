using System;
using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum TaskStatus
{
    NotStarted,
    InProgress,
    Completed
}

public class TaskItem
{
    public int TaskItemId { get; set; }

    [Required]
    public string Title { get; set; } = "";

    public string? Description { get; set; }

    public TaskStatus Status { get; set; } = TaskStatus.NotStarted;

    public DateTime? DueDate { get; set; }

    public int TrainingPlanId { get; set; }
    public TrainingPlan TrainingPlan { get; set; } = null!;
}