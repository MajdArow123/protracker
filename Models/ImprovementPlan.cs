namespace ProTracker.Models;

public class ImprovementPlan
{
    public int Id { get; set; }

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public string? WeeklyGoals { get; set; }
    public string? TrainingRecommendations { get; set; }
    public string? SkillTargets { get; set; }
    public string? SportSpecificDrills { get; set; }
    public string? PositionFocus { get; set; }
    public string? CoachNotes { get; set; }

    // Reserved for future AI-generated content; false for everything created by a coach today.
    public bool IsAIGenerated { get; set; } = false;
}
