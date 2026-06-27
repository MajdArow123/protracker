using ProTracker.Models;

namespace ProTracker.Dtos;

public class NutritionGuidanceDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public DateTime CreatedDate { get; set; }
    public string? Goal { get; set; }
    public string? MealSuggestions { get; set; }
    public string? HydrationTips { get; set; }
    public string? RecoveryTips { get; set; }
    public string? FoodsToPrioritize { get; set; }
    public string? FoodsToLimit { get; set; }
    public string Disclaimer { get; set; } = "";
    public bool IsAIGenerated { get; set; }
}

public class CreateNutritionGuidanceDto
{
    public int PlayerId { get; set; }
    public string? Goal { get; set; }
    public string? MealSuggestions { get; set; }
    public string? HydrationTips { get; set; }
    public string? RecoveryTips { get; set; }
    public string? FoodsToPrioritize { get; set; }
    public string? FoodsToLimit { get; set; }
}

public class NutritionProfileItemDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public NutritionPreferenceType PreferenceType { get; set; }
    public NutritionCategory Category { get; set; }
    public string? SpecificItem { get; set; }
    public NutritionSeverity Severity { get; set; }
    public string? Notes { get; set; }
}

public class CreateNutritionProfileItemDto
{
    public NutritionPreferenceType PreferenceType { get; set; }
    public NutritionCategory Category { get; set; }
    public string? SpecificItem { get; set; }
    public NutritionSeverity Severity { get; set; }
    public string? Notes { get; set; }
}

public class FoodAlternativeDto
{
    public int Id { get; set; }
    public string OriginalFood { get; set; } = "";
    public string AlternativeFood { get; set; } = "";
    public int ProteinMatchScore { get; set; }
    public int CarbMatchScore { get; set; }
    public int FatMatchScore { get; set; }
    public int CalorieMatchScore { get; set; }
    public int RecoveryValue { get; set; }
    public string? SportPerformanceNote { get; set; }
    public string? ReasonExplanation { get; set; }
}
