using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAIRecoveryService
{
    Task<RecoveryPlanDto> GenerateRecoveryPlanAsync(ClaimsPrincipal user, int injuryId);
}

// AI injury-recovery plan generation. Prompt construction and response parsing live
// here; persistence goes through IRecoveryPlanService like the manual flow.
public class AIRecoveryService : IAIRecoveryService
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly IRecoveryPlanService _recoveryPlanService;
    private readonly ILogger<AIRecoveryService> _logger;

    public AIRecoveryService(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        IRecoveryPlanService recoveryPlanService,
        ILogger<AIRecoveryService> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _recoveryPlanService = recoveryPlanService;
        _logger = logger;
    }

    public async Task<RecoveryPlanDto> GenerateRecoveryPlanAsync(ClaimsPrincipal user, int injuryId)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == injuryId)
            ?? throw new NotFoundApiException($"Injury {injuryId} not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == injury.PlayerId)
            ?? throw new NotFoundApiException("Player not found.");

        var prompt = BuildRecoveryPrompt(injury, player);
        // Prefill guarantees the model starts with the JSON object. 8000 tokens gives Haiku
        // room for a full multi-week plan with detailed descriptions (4000 could truncate).
        const string prefill = "{\"title\":";

        // Haiku occasionally emits malformed/truncated JSON; retry once before surfacing an error.
        GeneratedRecoveryPlan? generated = null;
        string lastRaw = "";
        for (var attempt = 1; attempt <= 2 && generated == null; attempt++)
        {
            lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 8000, modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);
            try
            {
                var root = JsonDocument.Parse(lastRaw).RootElement;
                generated = ParseRecoveryPlan(root);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Recovery plan parse failed (attempt {Attempt})", attempt);
            }
        }

        if (generated == null)
        {
            _logger.LogError("Failed to parse AI recovery plan after retries: {Raw}", lastRaw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        return await _recoveryPlanService.SaveGeneratedPlanAsync(user, injuryId, generated);
    }

    private static string BuildRecoveryPrompt(InjuryRecord injury, Player p)
    {
        // Sport/position/age/fitness are all passed so exercises are relevant to THIS
        // athlete (e.g. a volleyball shoulder program ≠ a soccer hamstring program).
        return "You are a sports physiotherapist. Design a safe, progressive injury recovery program as JSON.\n\n"
            + "Athlete & injury context:\n"
            + $"- Sport: {p.Sport.Name}\n"
            + $"- Position: {p.Position.Name}\n"
            + $"- Age: {p.Age}\n"
            + $"- Fitness level: {AIEvidenceContextService.FitnessText(p)}\n"
            + $"- Injury type: {injury.InjuryType}\n"
            + $"- Body part: {injury.BodyPart ?? "unspecified"}\n"
            + $"- Severity: {injury.Severity}\n\n"
            + "Tailor every exercise to this sport and body part. Progress from rest/protection in early "
            + "weeks to sport-specific return-to-play in later weeks. Respect the severity when choosing "
            + "the number of weeks (Minor ~2-3, Moderate ~4-6, Severe ~6-10).\n\n"
            + "Return ONLY JSON in exactly this shape:\n"
            + "{\"title\": string, \"estimatedWeeks\": number, \"weeks\": [ {\"week\": number, \"focus\": string, "
            + "\"exercises\": [ {\"title\": string, \"description\": string, \"sets\": number|null, \"reps\": number|null, "
            + "\"durationMinutes\": number|null, \"restSeconds\": number|null, \"dayOfWeek\": \"Mon|Tue|Wed|Thu|Fri|Sat|Sun|All\", "
            + "\"category\": \"Mobility|Strength|Cardio|Flexibility|Balance|Ice|Heat|Rest\"} ] } ], "
            + "\"milestones\": [ {\"title\": string, \"targetWeek\": number} ] }\n"
            + "Provide 2-4 exercises per week and 3-4 milestones. Keep each description to 1-2 concise sentences. "
            + "Use null (not 0) for sets/reps/duration that don't apply.";
    }

    private static GeneratedRecoveryPlan ParseRecoveryPlan(JsonElement root)
    {
        int? GetInt(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : (int?)null;
        string GetStr(JsonElement el, string name, string fallback = "") =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? fallback) : fallback;

        var plan = new GeneratedRecoveryPlan
        {
            Title = GetStr(root, "title", "Recovery Program"),
            EstimatedWeeks = GetInt(root, "estimatedWeeks") ?? 4,
        };

        if (root.TryGetProperty("weeks", out var weeksEl) && weeksEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var weekEl in weeksEl.EnumerateArray())
            {
                var weekNum = GetInt(weekEl, "week") ?? 1;
                if (weekEl.TryGetProperty("exercises", out var exsEl) && exsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var exEl in exsEl.EnumerateArray())
                    {
                        var catStr = GetStr(exEl, "category", "Mobility");
                        Enum.TryParse<RecoveryExerciseCategory>(catStr, ignoreCase: true, out var cat);
                        plan.Exercises.Add(new RecoveryExercise
                        {
                            Title = GetStr(exEl, "title", "Exercise"),
                            Description = GetStr(exEl, "description"),
                            Sets = GetInt(exEl, "sets"),
                            Reps = GetInt(exEl, "reps"),
                            DurationMinutes = GetInt(exEl, "durationMinutes"),
                            RestSeconds = GetInt(exEl, "restSeconds"),
                            Week = weekNum,
                            DayOfWeek = GetStr(exEl, "dayOfWeek", "All"),
                            Category = cat,
                        });
                    }
                }
            }
        }

        if (root.TryGetProperty("milestones", out var msEl) && msEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var mEl in msEl.EnumerateArray())
            {
                plan.Milestones.Add(new RecoveryMilestone
                {
                    Title = GetStr(mEl, "title", "Milestone"),
                    TargetWeek = GetInt(mEl, "targetWeek") ?? 1,
                });
            }
        }

        return plan;
    }
}
