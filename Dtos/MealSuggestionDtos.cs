namespace ProTracker.Dtos;

// Contract for the public Vora iOS meal-suggestion endpoint (POST /api/v1/meal-suggestion).
// The response is returned BARE (no ApiResponse envelope) — the Vora client decodes
// exactly { mealName, detail, generatedAt }.

public class MealSuggestionRequest
{
    public double CaloriesRemaining { get; set; }
    public double ProteinRemaining { get; set; }
    public double CarbsRemaining { get; set; }
    public double FatRemaining { get; set; }
    public string GoalType { get; set; } = "";
    public string TimeOfDay { get; set; } = "";
}

public class MealSuggestionResponse
{
    public string MealName { get; set; } = "";
    public string Detail { get; set; } = "";
    public DateTime GeneratedAt { get; set; }
}
