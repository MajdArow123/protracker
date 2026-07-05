using Microsoft.EntityFrameworkCore;
using ProTracker.Models;

namespace ProTracker.Data;

// Seeds the whole-food library used by the meal-swap "equivalent food" matcher. Macros are
// stored PER 100g so the matcher can scale each food to any portion. Runs at startup; only
// inserts foods whose names aren't already present, so it's safe on every redeploy and can
// be extended later without duplicating existing rows.
public static class FoodItemSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        var existing = await context.FoodItems
            .Select(f => f.Name.ToLower())
            .ToListAsync();
        var have = new HashSet<string>(existing);

        var toAdd = BuildFoods().Where(f => !have.Contains(f.Name.ToLower())).ToList();
        if (toAdd.Count == 0) return;

        context.FoodItems.AddRange(toAdd);
        await context.SaveChangesAsync();
    }

    private static FoodItem F(string name, string cat, int cal, int p, int c, int f) =>
        new() { Name = name, Category = cat, CaloriesPer100g = cal, ProteinPer100g = p, CarbsPer100g = c, FatsPer100g = f };

    // Per-100g macros. Values are rounded whole-food averages — good enough for portion-scaled
    // swap suggestions (the matcher compares macro *profiles*, not exact grams).
    private static List<FoodItem> BuildFoods() => new()
    {
        // ── Proteins ──────────────────────────────────────────────────────────
        F("Chicken breast", "Protein", 165, 31, 0, 4),
        F("Turkey breast", "Protein", 135, 30, 0, 1),
        F("Ground turkey", "Protein", 176, 27, 0, 8),
        F("Tuna (canned)", "Protein", 116, 26, 0, 1),
        F("Salmon", "Protein", 208, 20, 0, 13),
        F("Cod", "Protein", 82, 18, 0, 1),
        F("Shrimp", "Protein", 99, 24, 0, 1),
        F("Eggs", "Protein", 155, 13, 1, 11),
        F("Egg whites", "Protein", 52, 11, 1, 0),
        F("Greek yogurt", "Protein", 59, 10, 4, 0),
        F("Cottage cheese", "Protein", 98, 11, 3, 4),
        F("Tofu", "Protein", 144, 17, 3, 9),
        F("Tempeh", "Protein", 192, 20, 8, 11),
        F("Edamame", "Protein", 121, 12, 9, 5),
        F("Lentils", "Protein", 116, 9, 20, 0),
        F("Chickpeas", "Protein", 164, 9, 27, 3),
        F("Black beans", "Protein", 132, 9, 24, 1),
        F("Lean beef", "Protein", 176, 20, 0, 10),
        F("Pork loin", "Protein", 143, 26, 0, 4),
        F("Whey protein powder", "Protein", 375, 80, 8, 5),

        // ── Carbs ─────────────────────────────────────────────────────────────
        F("Oats", "Carb", 389, 17, 66, 7),
        F("Brown rice", "Carb", 123, 3, 26, 1),
        F("White rice", "Carb", 130, 3, 28, 0),
        F("Quinoa", "Carb", 120, 4, 21, 2),
        F("Couscous", "Carb", 112, 4, 23, 0),
        F("Sweet potato", "Carb", 90, 2, 21, 0),
        F("Potato", "Carb", 87, 2, 20, 0),
        F("Whole wheat bread", "Carb", 247, 13, 41, 3),
        F("White bread", "Carb", 265, 9, 49, 3),
        F("Bagel", "Carb", 250, 10, 48, 2),
        F("Pasta", "Carb", 158, 6, 31, 1),
        F("Whole wheat pasta", "Carb", 149, 6, 30, 1),
        F("Banana", "Carb", 89, 1, 23, 0),
        F("Apple", "Carb", 52, 0, 14, 0),
        F("Orange", "Carb", 47, 1, 12, 0),
        F("Berries", "Carb", 57, 1, 14, 0),
        F("Dates", "Carb", 277, 2, 75, 0),
        F("Rice cakes", "Carb", 387, 8, 82, 3),
        F("Corn tortilla", "Carb", 218, 6, 45, 3),
        F("Granola", "Carb", 471, 10, 64, 20),

        // ── Fats ──────────────────────────────────────────────────────────────
        F("Avocado", "Fat", 160, 2, 9, 15),
        F("Almonds", "Fat", 579, 21, 22, 50),
        F("Walnuts", "Fat", 654, 15, 14, 65),
        F("Pistachios", "Fat", 560, 20, 28, 45),
        F("Pumpkin seeds", "Fat", 559, 30, 11, 49),
        F("Sunflower seeds", "Fat", 584, 21, 20, 51),
        F("Chia seeds", "Fat", 486, 17, 42, 31),
        F("Peanut butter", "Fat", 588, 25, 20, 50),
        F("Almond butter", "Fat", 614, 21, 19, 56),
        F("Olive oil", "Fat", 884, 0, 0, 100),
        F("Coconut oil", "Fat", 892, 0, 0, 100),
        F("Cheddar cheese", "Fat", 403, 25, 1, 33),

        // ── Vegetables ────────────────────────────────────────────────────────
        F("Broccoli", "Vegetable", 34, 3, 7, 0),
        F("Spinach", "Vegetable", 23, 3, 4, 0),
        F("Kale", "Vegetable", 49, 4, 9, 1),
        F("Cucumber", "Vegetable", 15, 1, 4, 0),
        F("Tomato", "Vegetable", 18, 1, 4, 0),
        F("Bell pepper", "Vegetable", 31, 1, 6, 0),
        F("Carrots", "Vegetable", 41, 1, 10, 0),
        F("Zucchini", "Vegetable", 17, 1, 3, 0),

        // ── Other ─────────────────────────────────────────────────────────────
        F("Milk", "Other", 50, 3, 5, 2),
        F("Almond milk", "Other", 15, 1, 1, 1),
        F("Honey", "Other", 304, 0, 82, 0),
        F("Protein bar", "Other", 350, 20, 40, 12),
    };
}
