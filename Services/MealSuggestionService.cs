using System.Text.Json;
using System.Text.RegularExpressions;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IMealSuggestionService
{
    Task<MealSuggestionResponse> SuggestAsync(MealSuggestionRequest request);
}

// AI meal suggestions for the public Vora iOS endpoint. Stateless: no player, no DB —
// the caller's remaining macros are the entire context. The model must return a strict
// JSON structure (guaranteed to start as JSON via the assistant-prefill trick) so the
// iOS app can match each food against its database.
public class MealSuggestionService : IMealSuggestionService
{
    private const string HaikuModel = "claude-haiku-4-5-20251001";
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(15);

    private static readonly JsonSerializerOptions ParseOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly IAIService _ai;
    private readonly ILogger<MealSuggestionService> _logger;

    public MealSuggestionService(IAIService ai, ILogger<MealSuggestionService> logger)
    {
        _ai = ai;
        _logger = logger;
    }

    public async Task<MealSuggestionResponse> SuggestAsync(MealSuggestionRequest request)
    {
        var prompt = BuildPrompt(request);

        // Two attempts on a malformed reply (the AIController retry pattern); a timeout
        // aborts immediately — retrying would push the caller past 30s.
        string lastRaw = "";
        for (var attempt = 1; attempt <= 2; attempt++)
        {
            using var cts = new CancellationTokenSource(RequestTimeout);
            try
            {
                lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 500,
                    modelOverride: HaikuModel, assistantPrefill: "{", ct: cts.Token);
            }
            catch (OperationCanceledException) when (cts.IsCancellationRequested)
            {
                _logger.LogError("Meal suggestion timed out after {Seconds}s (attempt {Attempt}).",
                    RequestTimeout.TotalSeconds, attempt);
                throw new InvalidOperationException("AI request timed out.");
            }

            try
            {
                var meal = ParseMealJson(lastRaw);
                // The requested meal type is authoritative — never trust the model to
                // echo it. No request value -> the model's value -> generic "meal".
                if (!string.IsNullOrWhiteSpace(request.MealType))
                    meal.MealType = request.MealType;
                else if (string.IsNullOrWhiteSpace(meal.MealType))
                    meal.MealType = "meal";
                meal.GeneratedAt = DateTime.UtcNow;
                return meal;
            }
            catch (FormatException ex)
            {
                _logger.LogWarning(ex, "Meal suggestion parse failed (attempt {Attempt}).", attempt);
            }
        }

        _logger.LogError("Failed to parse AI meal suggestion after retries: {Raw}", lastRaw);
        throw new InvalidOperationException("Could not generate a valid suggestion. Try again.");
    }

    // Strict on structure (meal name, 2-5 foods with names and positive grams), lenient
    // on cosmetics (missing description/cookingTip/unit get defaults — not worth a
    // retry). Public + pure for unit tests. Throws FormatException on violations.
    public static MealSuggestionResponse ParseMealJson(string raw)
    {
        ParsedMeal? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<ParsedMeal>(raw, ParseOptions);
        }
        catch (JsonException ex)
        {
            throw new FormatException("AI reply was not valid JSON.", ex);
        }

        if (parsed is null || string.IsNullOrWhiteSpace(parsed.MealName))
            throw new FormatException("AI reply is missing mealName.");
        if (parsed.Foods is null || parsed.Foods.Count < 2 || parsed.Foods.Count > 5)
            throw new FormatException("AI reply must contain 2-5 foods.");
        if (parsed.Foods.Any(f => string.IsNullOrWhiteSpace(f.Name) || f.Grams is null or <= 0))
            throw new FormatException("Every food needs a name and positive grams.");

        return new MealSuggestionResponse
        {
            MealName = parsed.MealName.Trim(),
            MealType = parsed.MealType?.Trim() ?? "",
            Description = parsed.Description?.Trim() ?? "",
            CookingTip = parsed.CookingTip?.Trim() ?? "",
            Foods = parsed.Foods.Select(f => new SuggestedFood
            {
                Name = f.Name!.Trim(),
                Grams = f.Grams!.Value,
                Unit = string.IsNullOrWhiteSpace(f.Unit) ? "g" : f.Unit.Trim(),
            }).ToList(),
        };
    }

    private string BuildPrompt(MealSuggestionRequest r)
    {
        var mealType = string.IsNullOrWhiteSpace(r.MealType) ? "meal" : r.MealType.Trim();
        var preference = SanitizePreference(r.UserPreference);
        var userPreferenceLine = preference.Length > 0 ? $"\n- User preference: {preference}" : "";

        return $$"""
            You are a precision nutrition assistant for a fitness tracking
            app. Return ONLY valid JSON, no other text.

            The user needs a {{mealType}} with these remaining macros:
            - Calories: {{r.CaloriesRemaining}} kcal
            - Protein: {{r.ProteinRemaining}}g
            - Carbs: {{r.CarbsRemaining}}g
            - Fat: {{r.FatRemaining}}g
            - Goal: {{r.GoalType}}
            - Time: {{r.TimeOfDay}}{{userPreferenceLine}}

            Return this exact JSON structure:
            {
              "mealName": "meal name here",
              "mealType": "{{mealType}}",
              "description": "one sentence description",
              "foods": [
                {
                  "name": "food name for database search",
                  "grams": 200,
                  "unit": "g"
                }
              ],
              "cookingTip": "one short cooking or prep tip"
            }

            Rules:
            - foods array must have 2-5 items
            - food names must be simple and searchable
              (e.g. 'chicken breast' not 'grilled seasoned chicken')
            - grams must be realistic portions
            - the combined macros of all foods must closely match
              the remaining macro targets
            - if userPreference specifies an ingredient, at least
              one food must include it
            - mealType must match what was requested
            """;
    }

    // The only free-text field that reaches the prompt: strip control characters and
    // collapse all whitespace to single spaces so it can't fake new prompt sections.
    private static string SanitizePreference(string? preference)
    {
        if (string.IsNullOrWhiteSpace(preference)) return "";
        var noControl = Regex.Replace(preference, @"\p{C}+", " ");
        return Regex.Replace(noControl, @"\s+", " ").Trim();
    }

    // Wire shape of the model's reply. Nullable throughout so structural validation
    // (not the deserializer) decides what's acceptable.
    private sealed class ParsedMeal
    {
        public string? MealName { get; set; }
        public string? MealType { get; set; }
        public string? Description { get; set; }
        public List<ParsedFood>? Foods { get; set; }
        public string? CookingTip { get; set; }
    }

    private sealed class ParsedFood
    {
        public string? Name { get; set; }
        public double? Grams { get; set; }
        public string? Unit { get; set; }
    }
}
