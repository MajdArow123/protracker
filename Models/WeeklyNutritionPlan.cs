namespace ProTracker.Models;

public class WeeklyNutritionPlan
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime WeekStartDate { get; set; }
    public bool IsAIGenerated { get; set; }
    public ICollection<DailyMealPlan> DailyMealPlans { get; set; } = new List<DailyMealPlan>();
}

public class DailyMealPlan
{
    public int Id { get; set; }
    public int WeeklyNutritionPlanId { get; set; }
    public WeeklyNutritionPlan WeeklyNutritionPlan { get; set; } = null!;

    // 1=Monday … 7=Sunday (ISO 8601)
    public int DayNumber { get; set; }
    public string DayName { get; set; } = "";
    public int DailyCalories { get; set; }
    public int DailyProtein { get; set; }
    public int DailyCarbs { get; set; }
    public int DailyFats { get; set; }
    public ICollection<PlannedMeal> PlannedMeals { get; set; } = new List<PlannedMeal>();
}

public class PlannedMeal
{
    public int Id { get; set; }
    public int DailyMealPlanId { get; set; }
    public DailyMealPlan DailyMealPlan { get; set; } = null!;
    public string MealType { get; set; } = "";  // Breakfast, Lunch, Snack, Dinner, PostWorkout
    public string Time { get; set; } = "";
    public ICollection<PlannedMealItem> PlannedMealItems { get; set; } = new List<PlannedMealItem>();
}

public class PlannedMealItem
{
    public int Id { get; set; }
    public int PlannedMealId { get; set; }
    public PlannedMeal PlannedMeal { get; set; } = null!;
    public string FoodName { get; set; } = "";
    public string Portion { get; set; } = "";
    public int Calories { get; set; }
    public int Protein { get; set; }
    public int Carbs { get; set; }
    public int Fats { get; set; }
    public bool IsSwapped { get; set; }
    public string? OriginalFoodName { get; set; }
}
