using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAINutritionService
{
    Task<NutritionGuidanceDto> GenerateGuidanceAsync(ClaimsPrincipal user, int playerId);
    Task<WeeklyNutritionPlanDto> GenerateWeeklyPlanAsync(ClaimsPrincipal user, int playerId);
}

// AI nutrition generation: one-off guidance and the 7-day weekly plan. Prompt
// construction, response parsing, and the hard-allergy safety scans live here.
public class AINutritionService : IAINutritionService
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly IWeeklyNutritionPlanService _weeklyPlanService;
    private readonly ILogger<AINutritionService> _logger;

    public AINutritionService(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        IWeeklyNutritionPlanService weeklyPlanService,
        ILogger<AINutritionService> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _weeklyPlanService = weeklyPlanService;
        _logger = logger;
    }

    // ─── Nutrition Guidance ───────────────────────────────────────────────────

    public async Task<NutritionGuidanceDto> GenerateGuidanceAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var profile = await _context.PlayerNutritionProfiles
            .Where(n => n.PlayerId == playerId)
            .ToListAsync();

        var restrictionLines = profile.Select(r => r.Severity switch
        {
            NutritionSeverity.Hard =>
                $"HARD ALLERGY/RULE: {r.Category} - {r.SpecificItem ?? r.Category.ToString()} - NEVER include this",
            NutritionSeverity.Lifestyle =>
                $"LIFESTYLE: {r.Category} - respect this always",
            _ =>
                $"PREFERENCE: {r.Category} - suggest alternatives",
        }).ToList();

        var restrictionBlock = restrictionLines.Any()
            ? string.Join("\n", restrictionLines)
            : "None recorded";

        var prompt = BuildNutritionPrompt(player, restrictionBlock);

        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI nutrition guidance generated for player {PlayerId}", playerId);

        try
        {
            var root = JsonDocument.Parse(raw).RootElement;
            var mealSuggestions = GetStr(root, "mealSuggestions");
            var foodsToPrioritize = GetStr(root, "foodsToPrioritize");

            var hardKeywords = profile
                .Where(r => r.Severity == NutritionSeverity.Hard && r.SpecificItem != null)
                .Select(r => r.SpecificItem!.ToLowerInvariant());
            var outputText = $"{mealSuggestions} {foodsToPrioritize} {raw}".ToLowerInvariant();
            var flagged = hardKeywords.Where(k => outputText.Contains(k)).ToList();
            var extraNote = flagged.Any()
                ? $"\n\nCoach review required: AI output may reference restricted items ({string.Join(", ", flagged)}). Please verify before using."
                : "";

            // Store the full structured JSON for rich frontend display
            string? mealPlanJson = null;
            if (root.TryGetProperty("meals", out var mealsEl) && mealsEl.ValueKind == JsonValueKind.Array)
                mealPlanJson = raw;

            var guidance = new NutritionGuidance
            {
                PlayerId = playerId,
                IsAIGenerated = true,
                Goal = GetStr(root, "goal"),
                MealSuggestions = mealSuggestions,
                HydrationTips = GetStr(root, "hydrationTips"),
                RecoveryTips = GetStr(root, "recoveryTips"),
                FoodsToPrioritize = foodsToPrioritize,
                FoodsToLimit = GetStr(root, "foodsToLimit"),
                Disclaimer = NutritionGuidance.StandardDisclaimer + extraNote,
                MealPlanJson = mealPlanJson,
            };
            _context.NutritionGuidances.Add(guidance);
            await _context.SaveChangesAsync();
            return GuidanceToDto(guidance);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI nutrition response: {Raw}", raw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }
    }

    // ─── Weekly Nutrition Plan ────────────────────────────────────────────────

    public async Task<WeeklyNutritionPlanDto> GenerateWeeklyPlanAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var profile = await _context.PlayerNutritionProfiles
            .Where(n => n.PlayerId == playerId)
            .ToListAsync();

        var restrictionBlock = profile.Any()
            ? string.Join("\n", profile.Select(r => r.Severity switch
            {
                NutritionSeverity.Hard =>
                    $"HARD ALLERGY/RULE: {r.Category} - {r.SpecificItem ?? r.Category.ToString()} - NEVER include this under any circumstances",
                NutritionSeverity.Lifestyle =>
                    $"LIFESTYLE: {r.Category} - always respect this",
                _ =>
                    $"PREFERENCE: {r.Category} - suggest alternatives when possible",
            }))
            : "None recorded";

        var prompt = BuildWeeklyNutritionPrompt(player, restrictionBlock);
        // Prefill forces the model to begin its output with valid JSON — no preamble, no placeholders.
        // 6000 tokens gives Haiku enough room even when it pretty-prints the full 7-day plan.
        const string prefill = "{\"days\":[";
        var raw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 6000, modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);

        WeeklyNutritionPlanDto planDto;
        try
        {
            var root = JsonDocument.Parse(raw).RootElement;
            var weekStart = DateTime.UtcNow.AddDays(-(int)DateTime.UtcNow.DayOfWeek + 1);

            planDto = new WeeklyNutritionPlanDto
            {
                PlayerId = playerId,
                IsAIGenerated = true,
                WeekStartDate = weekStart,
                DailyMealPlans = new List<DailyMealPlanDto>()
            };

            if (!root.TryGetProperty("days", out var daysEl) || daysEl.ValueKind != JsonValueKind.Array)
                throw new JsonException("Missing 'days' array in AI response.");

            int dayIndex = 1;
            foreach (var dayEl in daysEl.EnumerateArray())
            {
                var dayName = dayEl.TryGetProperty("dayOfWeek", out var d) ? d.GetString() ?? "" : "";
                var calories = dayEl.TryGetProperty("calories", out var c) ? c.GetInt32() : 0;
                var protein = 0; var carbs = 0; var fats = 0;
                if (dayEl.TryGetProperty("macros", out var macros))
                {
                    if (macros.TryGetProperty("protein", out var p)) protein = p.GetInt32();
                    if (macros.TryGetProperty("carbs", out var ca)) carbs = ca.GetInt32();
                    if (macros.TryGetProperty("fats", out var f)) fats = f.GetInt32();
                }

                var dayDto = new DailyMealPlanDto
                {
                    DayNumber = dayIndex++,
                    DayName = dayName,
                    DailyCalories = calories,
                    DailyProtein = protein,
                    DailyCarbs = carbs,
                    DailyFats = fats,
                    PlannedMeals = new List<PlannedMealDto>()
                };

                if (dayEl.TryGetProperty("meals", out var mealsEl) && mealsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var mealEl in mealsEl.EnumerateArray())
                    {
                        var mealType = mealEl.TryGetProperty("mealType", out var mt) ? mt.GetString() ?? "" : "";
                        var time = mealEl.TryGetProperty("time", out var t) ? t.GetString() ?? "" : "";
                        var mealDto = new PlannedMealDto
                        {
                            MealType = mealType,
                            Time = time,
                            PlannedMealItems = new List<PlannedMealItemDto>()
                        };

                        if (mealEl.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var itemEl in itemsEl.EnumerateArray())
                            {
                                mealDto.PlannedMealItems.Add(new PlannedMealItemDto
                                {
                                    FoodName = itemEl.TryGetProperty("food", out var fn) ? fn.GetString() ?? "" : "",
                                    Portion = itemEl.TryGetProperty("portion", out var po) ? po.GetString() ?? "" : "",
                                    Calories = itemEl.TryGetProperty("calories", out var ic) ? ic.GetInt32() : 0,
                                    Protein = itemEl.TryGetProperty("protein", out var ip) ? ip.GetInt32() : 0,
                                    Carbs = itemEl.TryGetProperty("carbs", out var icar) ? icar.GetInt32() : 0,
                                    Fats = itemEl.TryGetProperty("fats", out var ifa) ? ifa.GetInt32() : 0,
                                });
                            }
                        }
                        dayDto.PlannedMeals.Add(mealDto);
                    }
                }
                planDto.DailyMealPlans.Add(dayDto);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI weekly nutrition plan: {Raw}", raw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        // Safety check: scan all food names for hard allergy keywords
        var hardKeywords = profile
            .Where(r => r.Severity == NutritionSeverity.Hard && r.SpecificItem != null)
            .Select(r => r.SpecificItem!.ToLowerInvariant())
            .ToList();

        if (hardKeywords.Any())
        {
            var allFoods = planDto.DailyMealPlans
                .SelectMany(d => d.PlannedMeals)
                .SelectMany(m => m.PlannedMealItems)
                .Select(i => i.FoodName.ToLowerInvariant())
                .ToList();
            var flagged = hardKeywords.Where(k => allFoods.Any(f => f.Contains(k))).ToList();
            if (flagged.Any())
                _logger.LogWarning("Weekly plan for player {PlayerId} may contain restricted items: {Items}", playerId, string.Join(", ", flagged));
        }

        return await _weeklyPlanService.SavePlanAsync(user, playerId, planDto);
    }

    // ─── Prompt builders ─────────────────────────────────────────────────────

    private static string BuildNutritionPrompt(Player p, string restrictionBlock)
    {
        return "You are a professional sports nutritionist. Generate a detailed, structured daily meal plan for this athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n\n"
            + "DIETARY RESTRICTIONS (MUST BE RESPECTED):\n"
            + restrictionBlock + "\n\n"
            + "Generate a complete structured nutrition plan. Return ONLY valid JSON with NO other text, comments, or markdown:\n"
            + "{\n"
            + "  \"goal\": \"primary nutrition goal for this athlete\",\n"
            + "  \"dailyCalories\": 2800,\n"
            + "  \"macros\": {\"protein\": 160, \"carbs\": 320, \"fats\": 80, \"fiber\": 30},\n"
            + "  \"hydrationMl\": 3000,\n"
            + "  \"mealSuggestions\": \"brief overall meal approach description\",\n"
            + "  \"hydrationTips\": \"specific hydration recommendations\",\n"
            + "  \"recoveryTips\": \"post-training recovery nutrition advice\",\n"
            + "  \"foodsToPrioritize\": \"Chicken,Rice,Broccoli,Sweet Potato,Eggs\",\n"
            + "  \"foodsToLimit\": \"Processed foods,Sugary drinks,Fried foods\",\n"
            + "  \"meals\": [\n"
            + "    {\n"
            + "      \"name\": \"Breakfast\",\n"
            + "      \"time\": \"7:00 AM\",\n"
            + "      \"items\": [\n"
            + "        {\"food\": \"Oats\", \"portion\": \"100g\", \"calories\": 370, \"protein\": 13, \"carbs\": 67, \"fats\": 7}\n"
            + "      ]\n"
            + "    },\n"
            + "    {\"name\": \"Lunch\", \"time\": \"12:30 PM\", \"items\": []},\n"
            + "    {\"name\": \"Snack\", \"time\": \"3:30 PM\", \"items\": []},\n"
            + "    {\"name\": \"Dinner\", \"time\": \"7:00 PM\", \"items\": []},\n"
            + "    {\"name\": \"Post-Workout\", \"time\": \"Within 30 min of training\", \"items\": []}\n"
            + "  ]\n"
            + "}\n\n"
            + "CRITICAL: Never include foods that conflict with the hard allergies or lifestyle restrictions listed above.\n"
            + $"Include 3-5 realistic food items per meal with accurate macros for a {p.Sport.Name} athlete.\n"
            + "All numbers must be integers. Return ONLY the JSON object, nothing else.";
    }

    private static string BuildWeeklyNutritionPrompt(Player p, string restrictionBlock)
    {
        // The assistant turn is pre-filled with {"days":[ so the model outputs a
        // pure JSON continuation — no preamble, no markdown, no placeholders possible.
        return $"Sports nutritionist. Generate a 7-day meal plan as JSON.\n"
            + $"Athlete: {p.FullName}, {p.Sport.Name} {p.Position.Name}, age {p.Age}\n"
            + $"Restrictions (never include): {restrictionBlock}\n\n"
            + "Output: 7 days Monday-Sunday. Each day: 4 meals (Breakfast 7:00 AM, Lunch 12:30 PM, Snack 3:30 PM, Dinner 7:00 PM). Each meal: 3 food items.\n"
            + "Vary foods every day. All numbers must be integers.\n\n"
            + "Each day object: {\"dayOfWeek\":\"...\",\"calories\":N,\"macros\":{\"protein\":N,\"carbs\":N,\"fats\":N},\"meals\":[...]}\n"
            + "Each meal object: {\"mealType\":\"...\",\"time\":\"...\",\"items\":[...]}\n"
            + "Each item object: {\"food\":\"...\",\"portion\":\"...\",\"calories\":N,\"protein\":N,\"carbs\":N,\"fats\":N}\n\n"
            + "I have pre-started the JSON with {\"days\":[ — continue from there and close with ]}";
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static string? GetStr(JsonElement el, string key) =>
        el.TryGetProperty(key, out var p) ? p.GetString() : null;

    private static NutritionGuidanceDto GuidanceToDto(NutritionGuidance g) => new()
    {
        Id = g.Id,
        PlayerId = g.PlayerId,
        CreatedDate = g.CreatedDate,
        Goal = g.Goal,
        MealSuggestions = g.MealSuggestions,
        HydrationTips = g.HydrationTips,
        RecoveryTips = g.RecoveryTips,
        FoodsToPrioritize = g.FoodsToPrioritize,
        FoodsToLimit = g.FoodsToLimit,
        Disclaimer = g.Disclaimer,
        IsAIGenerated = g.IsAIGenerated,
        MealPlanJson = g.MealPlanJson,
    };
}
