using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class TrainingPlan
{
    public int TrainingPlanId { get; set; }

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    [Required]
    public string Title { get; set; } = "";

    public string? Goal { get; set; }

    public DateTime StartDate { get; set; } = DateTime.Today;
    public DateTime EndDate { get; set; } = DateTime.Today.AddDays(7);

    [Required]
    public string CoachId { get; set; } = "";

    [Required]
    public string AthleteId { get; set; } = "";

    public List<TaskItem> Tasks { get; set; } = new();
}