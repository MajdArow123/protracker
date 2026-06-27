namespace ProTracker.Models;

public enum NutritionPreferenceType
{
    Allergy,
    Lifestyle,
    SoftPreference
}

public enum NutritionCategory
{
    Vegetarian,
    Vegan,
    Halal,
    Kosher,
    GlutenFree,
    NutAllergy,
    DairyFree,
    NoEggs,
    NoFish,
    NoRedMeat,
    LowFODMAP,
    Custom
}

// Severity rules (enforced by guidance-generation logic, not by this model):
// Hard       -> allergy/strict rule. Never include in guidance, always show the safety
//               disclaimer, always recommend professional consultation.
// Lifestyle  -> vegetarian/vegan/halal/kosher/etc. Never override silently.
// Soft       -> dislike/preference. Suggest an alternative; a coach may override with a note.
public enum NutritionSeverity
{
    Hard,
    Lifestyle,
    Soft
}

public class PlayerNutritionProfile
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public NutritionPreferenceType PreferenceType { get; set; }
    public NutritionCategory Category { get; set; }

    // e.g. "peanuts", "shellfish" — only meaningful when Category is Custom/NutAllergy/etc.
    public string? SpecificItem { get; set; }

    public NutritionSeverity Severity { get; set; }
    public string? Notes { get; set; }
}
