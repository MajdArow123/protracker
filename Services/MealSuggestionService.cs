using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IMealSuggestionService
{
    Task<MealSuggestionResponse> SuggestAsync(MealSuggestionRequest request);
}

// AI meal suggestions for the public Vora iOS endpoint. Stateless: no player, no DB —
// the caller's remaining macros are the entire context.
public class MealSuggestionService : IMealSuggestionService
{
    private const string HaikuModel = "claude-haiku-4-5-20251001";
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(15);

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
                lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 300, modelOverride: HaikuModel, ct: cts.Token);
            }
            catch (OperationCanceledException) when (cts.IsCancellationRequested)
            {
                _logger.LogError("Meal suggestion timed out after {Seconds}s (attempt {Attempt}).",
                    RequestTimeout.TotalSeconds, attempt);
                throw new InvalidOperationException("AI request timed out.");
            }

            try
            {
                var (mealName, detail) = ParseMealText(lastRaw);
                return new MealSuggestionResponse
                {
                    MealName = mealName,
                    Detail = detail,
                    GeneratedAt = DateTime.UtcNow,
                };
            }
            catch (FormatException ex)
            {
                _logger.LogWarning(ex, "Meal suggestion parse failed (attempt {Attempt}).", attempt);
            }
        }

        _logger.LogError("Failed to parse AI meal suggestion after retries: {Raw}", lastRaw);
        throw new InvalidOperationException("AI returned an unexpected meal format.");
    }

    // First non-empty line = meal name, the rest = detail. Public + pure for unit tests.
    public static (string MealName, string Detail) ParseMealText(string raw)
    {
        var lines = raw.Split('\n')
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .ToList();

        if (lines.Count < 2)
            throw new FormatException("Expected a meal name line followed by detail lines.");

        return (lines[0], string.Join("\n", lines.Skip(1)));
    }

    private static string BuildPrompt(MealSuggestionRequest r) =>
        $"""
        You are a nutrition assistant for a fitness tracking app.
        The user has these remaining macros for today:
        - Calories remaining: {r.CaloriesRemaining} kcal
        - Protein remaining: {r.ProteinRemaining}g
        - Carbs remaining: {r.CarbsRemaining}g
        - Fat remaining: {r.FatRemaining}g
        - Time of day: {r.TimeOfDay}
        - Their goal: {r.GoalType}

        Suggest ONE specific meal or food combination that would
        closely match these remaining macros. Be specific with
        portions (e.g. 200g chicken breast + 1 cup rice + salad).
        Keep your response under 60 words. First line: meal name only.
        Second line onwards: specific foods and portions.
        No preamble, no explanation — just the meal suggestion.
        """;
}
