namespace ProTracker.Dtos;

public class ImprovementPlanDto
{
    public int Id { get; set; }
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
    public string? WeeklyGoals { get; set; }
    public string? TrainingRecommendations { get; set; }
    public string? SkillTargets { get; set; }
    public string? SportSpecificDrills { get; set; }
    public string? PositionFocus { get; set; }
    public string? CoachNotes { get; set; }
}
