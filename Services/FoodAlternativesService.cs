using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IFoodAlternativesService
{
    Task<List<FoodAlternativeDto>> GetAllAsync();
    Task<List<FoodAlternativeDto>> GetByOriginalFoodAsync(string originalFood);
    Task<List<EquivalentFoodDto>> GetEquivalentsAsync(
        int calories, int protein, int carbs, int fats, string? excludeName);
}

public class FoodAlternativesService : IFoodAlternativesService
{
    private readonly ApplicationDbContext _context;

    public FoodAlternativesService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<FoodAlternativeDto>> GetAllAsync() =>
        await _context.FoodAlternativesLibrary.Select(ToDtoExpr()).ToListAsync();

    public async Task<List<FoodAlternativeDto>> GetByOriginalFoodAsync(string originalFood) =>
        await _context.FoodAlternativesLibrary
            .Where(f => f.OriginalFood.ToLower() == originalFood.ToLower())
            .Select(ToDtoExpr())
            .ToListAsync();

    // Finds foods from the per-100g library that can stand in for a meal item, each scaled to a
    // portion matching the item's calories. Because both foods are compared at the same calorie
    // level, foods with a similar macro *profile* (e.g. chicken → turkey) score as good matches
    // even though their raw per-100g numbers differ — the core of the swap fix.
    public async Task<List<EquivalentFoodDto>> GetEquivalentsAsync(
        int calories, int protein, int carbs, int fats, string? excludeName)
    {
        if (calories <= 0) return new();

        var foods = await _context.FoodItems.ToListAsync();
        var exclude = (excludeName ?? "").Trim().ToLowerInvariant();
        var results = new List<(EquivalentFoodDto dto, double score)>();

        foreach (var f in foods)
        {
            if (f.CaloriesPer100g <= 0) continue;
            if (!string.IsNullOrEmpty(exclude) && f.Name.ToLowerInvariant() == exclude) continue;

            // Scale the portion so this food delivers the same calories as the original item.
            var grams = (double)calories / f.CaloriesPer100g * 100.0;
            var roundedGrams = (int)(Math.Round(grams / 5.0) * 5);
            // Skip absurd portions (a whole meal's calories as 1.5kg of broccoli, or a splash of oil).
            if (roundedGrams < 10 || roundedGrams > 600) continue;

            var factor = roundedGrams / 100.0;
            var sCal = (int)Math.Round(f.CaloriesPer100g * factor);
            var sP = (int)Math.Round(f.ProteinPer100g * factor);
            var sC = (int)Math.Round(f.CarbsPer100g * factor);
            var sF = (int)Math.Round(f.FatsPer100g * factor);

            // Hybrid tolerance: a macro passes if it's within the % band OR within a small absolute
            // gram gap. The absolute floor matters for lean foods — e.g. chicken (8g fat) → turkey
            // (2g fat) is a trivial 6g gap but a misleading 75% relative diff.
            bool good = MacroOk(calories, sCal, 0.20, 40)
                && MacroOk(protein, sP, 0.25, 6)
                && MacroOk(carbs, sC, 0.25, 6)
                && MacroOk(fats, sF, 0.25, 6);
            bool similar = MacroOk(calories, sCal, 0.30, 70)
                && MacroOk(protein, sP, 0.35, 12)
                && MacroOk(carbs, sC, 0.35, 12)
                && MacroOk(fats, sF, 0.35, 12);
            string quality = good ? "good" : similar ? "similar" : "different";

            var calDiff = PctDiff(calories, sCal);
            var sortScore = calDiff + PctDiff(protein, sP) + PctDiff(carbs, sC) + PctDiff(fats, sF);

            results.Add((new EquivalentFoodDto
            {
                Id = f.Id,
                FoodName = f.Name,
                Category = f.Category,
                SuggestedPortion = $"{roundedGrams}g",
                Calories = sCal,
                Protein = sP,
                Carbs = sC,
                Fats = sF,
                IsGoodMatch = good,
                MatchQuality = quality,
                OriginalCalories = calories,
                CaloriesDiffPct = Math.Round(calDiff * 100, 1),
            }, sortScore));
        }

        // Best matches first so green "Good match" foods surface at the top of the swap list.
        return results.OrderBy(r => r.score).Select(r => r.dto).ToList();
    }

    // A candidate macro is acceptable if it's within `relTol` of the original OR within `absTol`
    // grams/calories of it — whichever is more forgiving.
    private static bool MacroOk(int original, int candidate, double relTol, int absTol)
    {
        var gap = Math.Abs(candidate - original);
        return gap <= absTol || gap <= original * relTol;
    }

    // Percent difference with a floor on the denominator so near-zero macros (e.g. a food with
    // 0g carbs) don't produce divide-by-zero or hyper-sensitive results. Used only for sorting.
    private static double PctDiff(int original, int candidate)
    {
        var denom = Math.Max(Math.Abs(original), 5);
        return Math.Abs(candidate - original) / (double)denom;
    }

    private static System.Linq.Expressions.Expression<Func<ProTracker.Models.FoodAlternativesLibrary, FoodAlternativeDto>> ToDtoExpr() =>
        f => new FoodAlternativeDto
        {
            Id = f.Id,
            OriginalFood = f.OriginalFood,
            AlternativeFood = f.AlternativeFood,
            ProteinMatchScore = f.ProteinMatchScore,
            CarbMatchScore = f.CarbMatchScore,
            FatMatchScore = f.FatMatchScore,
            CalorieMatchScore = f.CalorieMatchScore,
            RecoveryValue = f.RecoveryValue,
            SportPerformanceNote = f.SportPerformanceNote,
            ReasonExplanation = f.ReasonExplanation,
            SuggestedPortion = f.SuggestedPortion,
            Calories = f.Calories,
            Protein = f.Protein,
            Carbs = f.Carbs,
            Fats = f.Fats,
        };
}
