namespace ProTracker.Models;

// A single whole food with macros stored PER 100g. The swap tool scales each item's
// portion so its calories match the meal item being replaced, then compares macro
// profiles — this is what makes "Chicken 150g → Turkey 175g" register as a good match
// even though the raw library values differ. Distinct from FoodAlternativesLibrary,
// which is the coach's curated original→alternative reference pairs.
public class FoodItem
{
    public int Id { get; set; }

    public string Name { get; set; } = "";
    // Protein / Carb / Fat / Vegetable / Other — for grouping and sensible swaps.
    public string Category { get; set; } = "";

    // Per 100g.
    public int CaloriesPer100g { get; set; }
    public int ProteinPer100g { get; set; }
    public int CarbsPer100g { get; set; }
    public int FatsPer100g { get; set; }
}
