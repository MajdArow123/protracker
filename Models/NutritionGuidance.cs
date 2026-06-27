namespace ProTracker.Models;

public class NutritionGuidance
{
    public const string StandardDisclaimer =
        "This is general guidance only. For allergies, medical conditions, or serious dietary needs, please consult a qualified professional.";

    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public string? Goal { get; set; }
    public string? MealSuggestions { get; set; }
    public string? HydrationTips { get; set; }
    public string? RecoveryTips { get; set; }
    public string? FoodsToPrioritize { get; set; }
    public string? FoodsToLimit { get; set; }

    public string Disclaimer { get; set; } = StandardDisclaimer;

    // Reserved for future AI-generated content; false for everything created by a coach today.
    public bool IsAIGenerated { get; set; } = false;
}
