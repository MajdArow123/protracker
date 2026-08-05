namespace ProTracker.Dtos;

public class ImprovementPlanDto
{
    public int Id { get; set; }
    // Set only on a CREATE response when season resolution was Ambiguous — a
    // non-blocking nudge (Phase 10 S3); null on reads and on clean resolutions.
    public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    public int PlayerId { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? WeeklyGoals { get; set; }
    public string? TrainingRecommendations { get; set; }
    public string? SkillTargets { get; set; }
    public string? SportSpecificDrills { get; set; }
    public string? PositionFocus { get; set; }
    public string? CoachNotes { get; set; }
    public bool IsAIGenerated { get; set; }
}

public class CreateImprovementPlanDto
{
    public int PlayerId { get; set; }
    // The client's LOCAL calendar date "today" (yyyy-MM-dd) — drives season resolution
    // (S2.2 ruling). Falls back to UTC today when absent; must be within ±1 day of it.
    public string? LocalDate { get; set; }
    public string? WeeklyGoals { get; set; }
    public string? TrainingRecommendations { get; set; }
    public string? SkillTargets { get; set; }
    public string? SportSpecificDrills { get; set; }
    public string? PositionFocus { get; set; }
    public string? CoachNotes { get; set; }
}
