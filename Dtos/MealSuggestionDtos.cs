namespace ProTracker.Dtos;

// Contract for the public Vora iOS meal-suggestion endpoint (POST /api/v1/meal-suggestion).
// The response is returned BARE (no ApiResponse envelope) — the Vora client decodes
// exactly { mealName, mealType, description, foods, cookingTip, generatedAt }.

public class MealSuggestionRequest
{
    public double CaloriesRemaining { get; set; }
    public double ProteinRemaining { get; set; }
    public double CarbsRemaining { get; set; }
    public double FatRemaining { get; set; }
    public string GoalType { get; set; } = "";
    public string TimeOfDay { get; set; } = "";
    // Optional: breakfast | lunch | dinner | snack | postWorkout.
    public string? MealType { get; set; }
    // Optional free text ("something with chicken"), max 100 chars — the only
    // free-text field that reaches the AI prompt (sanitized in the service).
    public string? UserPreference { get; set; }
}

public class MealSuggestionResponse
{
    public string MealName { get; set; } = "";
    public string MealType { get; set; } = "";
    public string Description { get; set; } = "";
    public List<SuggestedFood> Foods { get; set; } = new();
    public string CookingTip { get; set; } = "";
    public DateTime GeneratedAt { get; set; }
}

// Simple, database-searchable food line ("chicken breast", 200, "g").
public class SuggestedFood
{
    public string Name { get; set; } = "";
    public double Grams { get; set; }
    public string Unit { get; set; } = "g";
}
