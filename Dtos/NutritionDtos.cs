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
    public string? MealPlanJson { get; set; }
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
    public string? SuggestedPortion { get; set; }
    public int? Calories { get; set; }
    public int? Protein { get; set; }
    public int? Carbs { get; set; }
    public int? Fats { get; set; }
}

// ── Weekly Nutrition Plan DTOs ───────────────────────────────────────────────

public class PlannedMealItemDto
{
    public int Id { get; set; }
    public int PlannedMealId { get; set; }
    public string FoodName { get; set; } = "";
    public string Portion { get; set; } = "";
    public int Calories { get; set; }
    public int Protein { get; set; }
    public int Carbs { get; set; }
    public int Fats { get; set; }
    public bool IsSwapped { get; set; }
    public string? OriginalFoodName { get; set; }
}

public class PlannedMealDto
{
    public int Id { get; set; }
    public int DailyMealPlanId { get; set; }
    public string MealType { get; set; } = "";
    public string Time { get; set; } = "";
    public List<PlannedMealItemDto> PlannedMealItems { get; set; } = new();
}

public class DailyMealPlanDto
{
    public int Id { get; set; }
    public int WeeklyNutritionPlanId { get; set; }
    public int DayNumber { get; set; }
    public string DayName { get; set; } = "";
    public int DailyCalories { get; set; }
    public int DailyProtein { get; set; }
    public int DailyCarbs { get; set; }
    public int DailyFats { get; set; }
    public List<PlannedMealDto> PlannedMeals { get; set; } = new();
}

public class WeeklyNutritionPlanDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime WeekStartDate { get; set; }
    public bool IsAIGenerated { get; set; }
    public List<DailyMealPlanDto> DailyMealPlans { get; set; } = new();
}

public class SwapMealItemDto
{
    public string NewFoodName { get; set; } = "";
    public string NewPortion { get; set; } = "";
    public int NewCalories { get; set; }
    public int NewProtein { get; set; }
    public int NewCarbs { get; set; }
    public int NewFats { get; set; }
}
