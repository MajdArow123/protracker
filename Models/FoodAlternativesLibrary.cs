using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class FoodAlternativesLibrary
{
    public int Id { get; set; }

    [Required]
    public string OriginalFood { get; set; } = "";

    [Required]
    public string AlternativeFood { get; set; } = "";

    // All match/value scores use a 1-5 scale (deliberately distinct from the
    // 1-10 scale used for player stats/performance/fitness).
    [Range(1, 5)]
    public int ProteinMatchScore { get; set; }

    [Range(1, 5)]
    public int CarbMatchScore { get; set; }

    [Range(1, 5)]
    public int FatMatchScore { get; set; }

    [Range(1, 5)]
    public int CalorieMatchScore { get; set; }

    [Range(1, 5)]
    public int RecoveryValue { get; set; }

    public string? SportPerformanceNote { get; set; }
    public string? ReasonExplanation { get; set; }

    // Actual nutritional data for the alternative food (used by swap modal)
    public string? SuggestedPortion { get; set; }
    public int? Calories { get; set; }
    public int? Protein { get; set; }
    public int? Carbs { get; set; }
    public int? Fats { get; set; }
}
