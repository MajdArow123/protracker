using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/ai")]
[Authorize(Roles = "Coach,Admin,SoloAthlete")]
public class AIController : ApiControllerBase, IAsyncActionFilter
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly IWeeklyNutritionPlanService _weeklyPlanService;
    private readonly IRecoveryPlanService _recoveryPlanService;
    private readonly IBillingService _billing;
    private readonly IDrillService _drills;
    private readonly ILogger<AIController> _logger;

    public AIController(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        IWeeklyNutritionPlanService weeklyPlanService,
        IRecoveryPlanService recoveryPlanService,
        IBillingService billing,
        IDrillService drills,
        ILogger<AIController> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _weeklyPlanService = weeklyPlanService;
        _recoveryPlanService = recoveryPlanService;
        _billing = billing;
        _drills = drills;
        _logger = logger;
    }

    // Every AI endpoint requires a plan with AI enabled (Pro/Team). Gate them all in one place —
    // the controller acts as its own action filter.
    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        await _billing.EnsureAiAllowedAsync(User);
        await next();
    }

    // ─── Evidence context (Phase G) ──────────────────────────────────────────

    // Real evidence data injected into AI prompts: calculated scores with confidence,
    // raw measured test values, and match stat trends. Empty sections are omitted so
    // prompts for players without evidence stay unchanged.
    private sealed record EvidenceContext(
        string ScoresText, string TestsText, string MatchTrendText,
        List<string> LowConfidenceMetrics, bool HasEvidence,
        List<EvidenceBasedScore> Scores);

    private async Task<EvidenceContext> BuildEvidenceContextAsync(int playerId)
    {
        var since = DateTime.UtcNow.AddDays(-EvidenceScoringEngine.EvidenceWindowDays);

        var scores = await _context.EvidenceBasedScores
            .Include(s => s.MetricDefinition)
            .Where(s => s.PlayerId == playerId && s.AssessmentId == null)
            .ToListAsync();

        var tests = await _context.ObjectiveTestResults
            .Include(t => t.MetricDefinition)
            .Where(t => t.PlayerId == playerId && t.TestedAt >= since)
            .OrderByDescending(t => t.TestedAt)
            .Take(10).ToListAsync();

        var matchEntries = await _context.MatchStatEntries
            .Where(m => m.PlayerId == playerId && m.StatDate >= since)
            .OrderByDescending(m => m.StatDate)
            .Take(8).ToListAsync();

        var scoresText = string.Join("\n", scores
            .OrderBy(s => s.FinalScore)
            .Select(s =>
            {
                List<string> sources;
                try { sources = JsonSerializer.Deserialize<List<string>>(s.EvidenceSources) ?? new(); }
                catch (JsonException) { sources = new(); }
                return $"- {s.MetricDefinition.Name}: {s.FinalScore}/10 ({s.Confidence} confidence — from {string.Join(", ", sources)})";
            }));

        var testsText = string.Join("\n", tests.Select(t =>
            $"- {t.TestedAt:yyyy-MM-dd}: {t.MetricDefinition.Name} test = {t.Value:0.##} {t.Unit}"));

        var matchTrendText = string.Join("\n", matchEntries.Select(m =>
        {
            var stats = EvidenceScoringEngine.ParseStatsJson(m.StatsJson);
            var statText = string.Join(", ", stats.Select(kv => $"{kv.Key}: {kv.Value:0.##}"));
            return $"- {m.StatDate:yyyy-MM-dd}: {statText}";
        }));

        var lowConfidence = scores
            .Where(s => s.Confidence is EvidenceConfidence.Low or EvidenceConfidence.Medium)
            .Select(s => $"{s.MetricDefinition.Name} ({s.Confidence})")
            .ToList();

        return new EvidenceContext(scoresText, testsText, matchTrendText, lowConfidence,
            scores.Count > 0 || tests.Count > 0 || matchEntries.Count > 0, scores);
    }

    // Honest fitness line for prompts: never fabricate a value for players
    // whose fitness was never recorded (nullable since the tactical layer).
    private static string FitnessText(Player p) =>
        p.FitnessLevel is int f ? $"{f}/10" : "not recorded";

    // The evidence sections appended to prompts (empty string when no evidence exists).
    private static string EvidencePromptBlock(EvidenceContext e)
    {
        if (!e.HasEvidence) return "";
        var sb = new StringBuilder("\n");
        if (e.ScoresText.Length > 0)
            sb.Append("Evidence-based scores (weighted from real measurements — more reliable than slider scores):\n")
              .Append(e.ScoresText).Append("\n\n");
        if (e.TestsText.Length > 0)
            sb.Append("Measured test results:\n").Append(e.TestsText).Append("\n\n");
        if (e.MatchTrendText.Length > 0)
            sb.Append("Recent match statistics:\n").Append(e.MatchTrendText).Append("\n\n");
        if (e.LowConfidenceMetrics.Count > 0)
            sb.Append("Metrics with weak evidence (Low/Medium confidence): ")
              .Append(string.Join(", ", e.LowConfidenceMetrics)).Append('\n');
        return sb.ToString();
    }

    // ─── Improvement Plan ────────────────────────────────────────────────────

    [HttpPost("improvement-plan/{playerId}")]
    public async Task<ActionResult> GenerateImprovementPlan(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var latestAssessment = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();

        var scoreLines = latestAssessment?.StatScores
            .Select(s => $"- {s.SportStatCategory.Name}: {s.Score}/10")
            ?? Enumerable.Empty<string>();

        var scoresText = scoreLines.Any()
            ? string.Join("\n", scoreLines)
            : "- No assessment data yet";

        var evidence = await BuildEvidenceContextAsync(playerId);
        var prompt = BuildImprovementPrompt(player, scoresText, EvidencePromptBlock(evidence));

        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI improvement plan generated for player {PlayerId}", playerId);

        ImprovementPlanDto dto;
        try
        {
            var root = JsonDocument.Parse(raw).RootElement;
            var plan = new ImprovementPlan
            {
                PlayerId = playerId,
                IsAIGenerated = true,
                WeeklyGoals = GetStr(root, "weeklyGoals"),
                TrainingRecommendations = GetStr(root, "trainingRecommendations"),
                SkillTargets = GetStr(root, "skillTargets"),
                SportSpecificDrills = GetStr(root, "sportSpecificDrills"),
                PositionFocus = GetStr(root, "positionFocus"),
                CoachNotes = GetStr(root, "coachNotes"),
            };
            _context.ImprovementPlans.Add(plan);
            await _context.SaveChangesAsync();
            dto = PlanToDto(plan);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI improvement plan: {Raw}", raw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        return Success(dto);
    }

    // ─── Task Suggestions ─────────────────────────────────────────────────────

    [HttpPost("task-suggestions/{playerId}")]
    public async Task<ActionResult> GenerateTaskSuggestions(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var latestAssessment = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();

        // Weakest areas drive the suggestions. Evidence-based scores (weighted from real
        // tests/matches) are preferred when the player has enough of them; slider scores
        // are the fallback so players without evidence keep working exactly as before.
        var evidence = await BuildEvidenceContextAsync(playerId);
        List<string> weakAreas;
        if (evidence.Scores.Count >= 3)
        {
            weakAreas = evidence.Scores
                .OrderBy(s => s.FinalScore)
                .Take(4)
                .Select(s => $"{s.MetricDefinition.Name}: {s.FinalScore}/10 ({s.Confidence} confidence)")
                .ToList();
        }
        else
        {
            weakAreas = (latestAssessment?.StatScores ?? new List<PlayerStatScore>())
                .OrderBy(s => s.Score)
                .Take(4)
                .Select(s => $"{s.SportStatCategory.Name}: {s.Score}/10")
                .ToList();
        }

        var weakAreasText = weakAreas.Any()
            ? string.Join("\n", weakAreas.Select(w => $"- {w}"))
            : "- No assessment data yet; suggest well-rounded foundational tasks.";

        var prompt = BuildTaskSuggestionsPrompt(player, weakAreasText, EvidencePromptBlock(evidence));
        // Prefill guarantees a JSON array continuation; Haiku for speed (coach is waiting).
        const string prefill = "[";

        List<TaskSuggestionDto>? suggestions = null;
        string lastRaw = "";
        for (var attempt = 1; attempt <= 2 && suggestions == null; attempt++)
        {
            lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 2000, modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);
            try
            {
                suggestions = ParseTaskSuggestions(lastRaw);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Task suggestions parse failed (attempt {Attempt})", attempt);
            }
        }

        if (suggestions == null || suggestions.Count == 0)
        {
            _logger.LogError("Failed to parse AI task suggestions after retries: {Raw}", lastRaw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        _logger.LogInformation("AI task suggestions generated for player {PlayerId}", playerId);
        return Success(new TaskSuggestionsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Suggestions = suggestions,
        });
    }

    private static string BuildTaskSuggestionsPrompt(Player p, string weakAreasText, string evidenceBlock = "")
    {
        return "You are an elite sports performance coach. Suggest 5 concrete, assignable tasks/drills to help "
            + "this athlete improve their weakest areas. The coach will assign these directly to the athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness level: {FitnessText(p)}\n\n"
            + "Weakest assessment areas (lowest scores first):\n"
            + weakAreasText + "\n"
            + evidenceBlock + "\n"
            + (evidenceBlock.Length > 0
                ? "Where measured values exist, reference them in the task description or rationale "
                  + "(e.g. \"improve your 30m sprint from 4.0s toward 3.8s\").\n\n"
                : "")
            + "Return ONLY a JSON array of exactly 5 task objects, no other text. Each object:\n"
            + "{\"title\": string (short, imperative, e.g. \"Weak-foot passing drill\"), "
            + "\"description\": string (1-2 sentences: what to do and how often), "
            + "\"priority\": \"Low|Medium|High\" (High for the weakest areas), "
            + "\"category\": \"Training|Nutrition|Recovery|Tactical|Physical|Other\", "
            + "\"focusArea\": string (which weak category this targets), "
            + "\"rationale\": string (one short sentence on why)}\n\n"
            + "Make every task specific to this sport and position. Prioritise the lowest-scoring areas. "
            + "I have pre-started the JSON with [ — continue from there and close with ].";
    }

    private static List<TaskSuggestionDto> ParseTaskSuggestions(string raw)
    {
        string GetStr(JsonElement el, string name, string fallback = "") =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? fallback) : fallback;

        var root = JsonDocument.Parse(raw).RootElement;
        if (root.ValueKind != JsonValueKind.Array)
            throw new JsonException("Expected a JSON array of task suggestions.");

        var list = new List<TaskSuggestionDto>();
        foreach (var el in root.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;

            Enum.TryParse<TaskPriority>(GetStr(el, "priority", "Medium"), ignoreCase: true, out var priority);
            Enum.TryParse<TaskCategory>(GetStr(el, "category", "Training"), ignoreCase: true, out var category);

            var title = GetStr(el, "title").Trim();
            if (string.IsNullOrEmpty(title)) continue;

            list.Add(new TaskSuggestionDto
            {
                Title = title,
                Description = GetStr(el, "description").Trim(),
                Priority = priority,
                Category = category,
                FocusArea = GetStr(el, "focusArea").Trim() is { Length: > 0 } fa ? fa : null,
                Rationale = GetStr(el, "rationale").Trim() is { Length: > 0 } r ? r : null,
            });
        }
        return list;
    }

    // ─── Goal Suggestions ─────────────────────────────────────────────────────

    // Suggests 3-5 SMART goals from the player's weakest assessment areas + sport/position.
    // Each suggestion is linked back to its stat category so accepting it enables assessment
    // auto-tracking. Coach/solo only (matches the rest of this controller).
    [HttpPost("goal-suggestions/{playerId}")]
    public async Task<ActionResult> GenerateGoalSuggestions(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var latestAssessment = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();

        // Weakest categories drive the suggestions — bottom 4 by score.
        var weakScores = (latestAssessment?.StatScores ?? new List<PlayerStatScore>())
            .OrderBy(s => s.Score)
            .Take(4)
            .ToList();
        var weakAreas = weakScores
            .Select(s => $"{s.SportStatCategory.Name}: {s.Score}/10")
            .ToList();
        // name (lowercased) -> (categoryId, currentScore) for linking accepted suggestions.
        var catByName = weakScores
            .GroupBy(s => s.SportStatCategory.Name.ToLowerInvariant())
            .ToDictionary(g => g.Key, g => (g.First().SportStatCategory.Id, g.First().Score));

        var weakAreasText = weakAreas.Any()
            ? string.Join("\n", weakAreas.Select(w => $"- {w}"))
            : "- No assessment data yet; suggest well-rounded foundational goals.";

        var prompt = BuildGoalSuggestionsPrompt(player, weakAreasText);
        const string prefill = "[";

        List<GoalSuggestionDto>? suggestions = null;
        string lastRaw = "";
        for (var attempt = 1; attempt <= 2 && suggestions == null; attempt++)
        {
            lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 2000, modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);
            try
            {
                suggestions = ParseGoalSuggestions(lastRaw, catByName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Goal suggestions parse failed (attempt {Attempt})", attempt);
            }
        }

        if (suggestions == null || suggestions.Count == 0)
        {
            _logger.LogError("Failed to parse AI goal suggestions after retries: {Raw}", lastRaw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        _logger.LogInformation("AI goal suggestions generated for player {PlayerId}", playerId);
        return Success(new GoalSuggestionsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Suggestions = suggestions,
        });
    }

    private static string BuildGoalSuggestionsPrompt(Player p, string weakAreasText)
    {
        return "You are an elite sports performance coach. Suggest 4 specific, measurable personal goals "
            + "to help this athlete improve, based on their weakest assessment areas. Goals should be "
            + "achievable in the given timeline and motivating.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness level: {FitnessText(p)}\n\n"
            + "Weakest assessment areas (score out of 10, lowest first):\n"
            + weakAreasText + "\n\n"
            + "Return ONLY a JSON array of exactly 4 goal objects, no other text. Each object:\n"
            + "{\"title\": string (short, e.g. \"Improve passing to 8.0\"), "
            + "\"description\": string (1 sentence on how to get there), "
            + "\"category\": \"Performance|Fitness|Nutrition|Mental|Technical|Tactical|Other\", "
            + "\"targetValue\": number (a realistic target on the 0-10 assessment scale, ~1.5-2.5 above current), "
            + "\"unit\": \"score\", "
            + "\"focusArea\": string (the EXACT weak category name this goal targets, verbatim), "
            + "\"timelineWeeks\": number (4-12)}\n\n"
            + "Make every goal specific to this sport and position. Prioritise the lowest-scoring areas. "
            + "Use category \"Performance\" for assessment-score goals. "
            + "I have pre-started the JSON with [ — continue from there and close with ].";
    }

    private static List<GoalSuggestionDto> ParseGoalSuggestions(string raw, IReadOnlyDictionary<string, (int Id, decimal Score)> catByName)
    {
        string GetStr(JsonElement el, string name, string fallback = "") =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? fallback) : fallback;
        decimal? GetDec(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;
        int? GetInt(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;

        var root = JsonDocument.Parse(raw).RootElement;
        if (root.ValueKind != JsonValueKind.Array)
            throw new JsonException("Expected a JSON array of goal suggestions.");

        var list = new List<GoalSuggestionDto>();
        foreach (var el in root.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;

            var title = GetStr(el, "title").Trim();
            if (string.IsNullOrEmpty(title)) continue;

            Enum.TryParse<GoalCategory>(GetStr(el, "category", "Performance"), ignoreCase: true, out var category);
            var focus = GetStr(el, "focusArea").Trim();

            int? linkedId = null;
            decimal? current = null;
            if (!string.IsNullOrEmpty(focus) && catByName.TryGetValue(focus.ToLowerInvariant(), out var match))
            {
                linkedId = match.Id;
                current = match.Score;
            }

            list.Add(new GoalSuggestionDto
            {
                Title = title,
                Description = GetStr(el, "description").Trim() is { Length: > 0 } d ? d : null,
                Category = category,
                TargetValue = GetDec(el, "targetValue"),
                CurrentValue = current,
                Unit = GetStr(el, "unit").Trim() is { Length: > 0 } u ? u : "score",
                LinkedStatCategoryId = linkedId,
                TimelineWeeks = GetInt(el, "timelineWeeks"),
                FocusArea = string.IsNullOrEmpty(focus) ? null : focus,
            });
        }
        return list;
    }

    // ─── Drill Recommendations ────────────────────────────────────────────────

    // Recommends drills from the library for the player's weakest assessment areas, ranked and
    // explained by Claude. Sport-aware; coach/solo only (matches the rest of this controller).
    [HttpPost("drill-recommendations/{playerId}")]
    public async Task<ActionResult> GenerateDrillRecommendations(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var latestAssessment = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();

        var weakScores = (latestAssessment?.StatScores ?? new List<PlayerStatScore>())
            .OrderBy(s => s.Score)
            .Take(3)
            .ToList();
        var weakAreas = weakScores.Select(s => $"{s.SportStatCategory.Name}: {s.Score}/10").ToList();
        var weakNames = weakScores.Select(s => s.SportStatCategory.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Candidate drills: the player's sport, preferring ones targeting a weak area.
        var sportDrills = (await _context.Drills.Where(d => d.IsBuiltIn).ToListAsync())
            .Where(d => d.SportIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(player.SportId.ToString()))
            .ToList();
        bool HitsWeak(Drill d) => (d.TargetStatCategories ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(t => weakNames.Contains(t));
        var candidates = sportDrills.Where(HitsWeak).ToList();
        if (candidates.Count < 5) candidates = candidates.Concat(sportDrills.Where(d => !HitsWeak(d))).Distinct().ToList();
        candidates = candidates.Take(14).ToList();

        if (candidates.Count == 0)
            return BadRequest(new { success = false, message = "No drills are available for this sport yet." });

        var weakAreasText = weakAreas.Any() ? string.Join("\n", weakAreas.Select(w => $"- {w}"))
            : "- No assessment data yet; recommend well-rounded foundational drills.";
        var drillsText = string.Join("\n", candidates.Select(d =>
            $"- id {d.Id}: \"{d.Name}\" [{d.Category}/{d.Difficulty}] targets: {d.TargetStatCategories ?? "general"}"));

        var prompt = BuildDrillRecommendationsPrompt(player, weakAreasText, drillsText);
        const string prefill = "[";

        List<(int Id, string Reason, string? Target, TaskPriority Priority)>? recs = null;
        string lastRaw = "";
        var validIds = candidates.Select(c => c.Id).ToHashSet();
        for (var attempt = 1; attempt <= 2 && recs == null; attempt++)
        {
            lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 1500, modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);
            try { recs = ParseDrillRecommendations(lastRaw, validIds); }
            catch (Exception ex) { _logger.LogWarning(ex, "Drill recommendations parse failed (attempt {Attempt})", attempt); }
        }

        if (recs == null || recs.Count == 0)
        {
            _logger.LogError("Failed to parse AI drill recommendations after retries: {Raw}", lastRaw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        // Fetch full drill data (order preserved) and attach reasoning.
        var dtos = await _drills.GetManyAsync(User, recs.Select(r => r.Id));
        var byId = recs.ToDictionary(r => r.Id);
        var items = dtos.Select(d =>
        {
            var r = byId[d.Id];
            d.RecommendReason = r.Reason;
            d.RecommendTarget = r.Target;
            return new DrillRecommendationItemDto { Drill = d, Reasoning = r.Reason, TargetCategory = r.Target, Priority = r.Priority };
        }).ToList();

        _logger.LogInformation("AI drill recommendations generated for player {PlayerId}", playerId);
        return Success(new DrillRecommendationsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Recommendations = items,
        });
    }

    private static string BuildDrillRecommendationsPrompt(Player p, string weakAreasText, string drillsText)
    {
        return "You are an elite sports performance coach. From the drill list below, pick the 5 drills that "
            + "would most help this athlete improve their weakest areas, and explain why each helps.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n\n"
            + "Weakest assessment areas (lowest first):\n" + weakAreasText + "\n\n"
            + "Available drills:\n" + drillsText + "\n\n"
            + "Return ONLY a JSON array of exactly 5 objects, no other text. Each object:\n"
            + "{\"drillId\": number (from the list above), "
            + "\"reasoning\": string (one sentence on why this drill helps this athlete's weak areas), "
            + "\"targetCategory\": string (the weak category it most targets), "
            + "\"priority\": \"Low|Medium|High\" (High for the weakest areas)}\n\n"
            + "Only use drillIds from the list. Prioritise drills targeting the lowest-scoring areas. "
            + "I have pre-started the JSON with [ — continue from there and close with ].";
    }

    private static List<(int Id, string Reason, string? Target, TaskPriority Priority)> ParseDrillRecommendations(string raw, HashSet<int> validIds)
    {
        var root = JsonDocument.Parse(raw).RootElement;
        if (root.ValueKind != JsonValueKind.Array) throw new JsonException("Expected a JSON array.");

        string GetStr(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "") : "";

        var list = new List<(int, string, string?, TaskPriority)>();
        var seen = new HashSet<int>();
        foreach (var el in root.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            if (!el.TryGetProperty("drillId", out var idEl) || idEl.ValueKind != JsonValueKind.Number) continue;
            var id = idEl.GetInt32();
            if (!validIds.Contains(id) || !seen.Add(id)) continue;

            Enum.TryParse<TaskPriority>(GetStr(el, "priority") is { Length: > 0 } ps ? ps : "Medium", ignoreCase: true, out var priority);
            var target = GetStr(el, "targetCategory").Trim();
            list.Add((id, GetStr(el, "reasoning").Trim(), string.IsNullOrEmpty(target) ? null : target, priority));
        }
        return list;
    }

    // ─── Nutrition Guidance ───────────────────────────────────────────────────

    [HttpPost("nutrition-guidance/{playerId}")]
    public async Task<ActionResult> GenerateNutritionGuidance(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

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

        NutritionGuidanceDto dto;
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
            dto = GuidanceToDto(guidance);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI nutrition response: {Raw}", raw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        return Success(dto);
    }

    // ─── Weekly Nutrition Plan ────────────────────────────────────────────────

    [HttpPost("weekly-nutrition-plan/{playerId}")]
    public async Task<ActionResult> GenerateWeeklyNutritionPlan(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

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
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
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

        var saved = await _weeklyPlanService.SavePlanAsync(User, playerId, planDto);
        return Success(saved);
    }

    // ─── Injury Recovery Plan ─────────────────────────────────────────────────

    [HttpPost("recovery-plan/{injuryId}")]
    public async Task<ActionResult> GenerateRecoveryPlan(int injuryId)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == injuryId)
            ?? throw new NotFoundApiException($"Injury {injuryId} not found.");
        await _access.EnsureCanAccessPlayerAsync(User, injury.PlayerId);

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
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        var saved = await _recoveryPlanService.SaveGeneratedPlanAsync(User, injuryId, generated);
        return Success(saved);
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
            + $"- Fitness level: {FitnessText(p)}\n"
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

    // ─── Performance Insights ─────────────────────────────────────────────────

    [HttpPost("performance-insights/{playerId}")]
    public async Task<ActionResult> GeneratePerformanceInsights(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderBy(a => a.DateRecorded)
            .ToListAsync();

        var injuries = await _context.InjuryRecords
            .Where(i => i.PlayerId == playerId)
            .OrderByDescending(i => i.InjuryDate)
            .Take(5).ToListAsync();

        var matches = await _context.MatchPerformances
            .Where(m => m.PlayerId == playerId)
            .OrderByDescending(m => m.MatchDate)
            .Take(5).ToListAsync();

        var assessmentLines = string.Join("\n", assessments.Select(a =>
        {
            var avg = a.StatScores.Any() ? a.StatScores.Average(s => s.Score) : 0;
            return $"- {a.DateRecorded:yyyy-MM-dd}: avg {avg:F1}/10 ({a.AssessmentPeriod?.Name ?? "Unknown"})";
        }));

        var latest = assessments.LastOrDefault();
        var first = assessments.FirstOrDefault();

        var latestScores = string.Join("\n",
            latest?.StatScores.Select(s => $"- {s.SportStatCategory.Name}: {s.Score}/10")
            ?? Enumerable.Empty<string>());

        var changeLines = (first != null && latest != null && first.Id != latest.Id)
            ? string.Join("\n", first.StatScores.Select(fs =>
            {
                var ls = latest.StatScores.FirstOrDefault(s => s.SportStatCategoryId == fs.SportStatCategoryId);
                return ls != null ? $"- {fs.SportStatCategory.Name}: {fs.Score} → {ls.Score}" : null;
            }).Where(l => l != null))
            : "- Insufficient data for comparison";

        var injuryList = injuries.Any()
            ? string.Join(", ", injuries.Select(i => $"{i.InjuryType} ({i.Severity}, {i.RecoveryStatus})"))
            : "None";

        var matchList = matches.Any()
            ? string.Join(", ", matches.Select(m => $"vs {m.Opponent}: {m.PerformanceRating}/10"))
            : "None";

        var evidence = await BuildEvidenceContextAsync(playerId);
        var prompt = BuildInsightsPrompt(player, assessmentLines, latestScores, changeLines, injuryList, matchList,
            EvidencePromptBlock(evidence));
        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI performance insights generated for player {PlayerId}", playerId);

        try
        {
            var insights = JsonSerializer.Deserialize<List<string>>(raw) ?? new();
            return Success(new AIInsightsDto { Insights = insights, GeneratedAt = DateTime.UtcNow.ToString("o") });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI insights: {Raw}", raw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }
    }

    // ─── Evidence Analysis (Phase G) ─────────────────────────────────────────

    // AI review of the player's evidence quality: what's missing, which metrics would
    // benefit most from objective tests, a recommended test battery for the sport/
    // position, and a confidence-improvement roadmap. Stateless (nothing persisted).
    [HttpPost("evidence-analysis/{playerId}")]
    public async Task<ActionResult> GenerateEvidenceAnalysis(int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(User, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var defs = await _context.SportMetricDefinitions
            .Where(d => d.SportId == player.SportId)
            .ToListAsync();
        var evidence = await BuildEvidenceContextAsync(playerId);

        var scoredIds = evidence.Scores.Select(s => s.MetricDefinitionId).ToHashSet();
        var noEvidence = defs.Where(d => !scoredIds.Contains(d.Id)).Select(d => d.Name).ToList();
        var testableMetrics = defs
            .Where(d => d.InputType != MetricInputType.Rating)
            .Select(d => $"{d.Name} ({d.Notes ?? d.Unit ?? "measured test"})")
            .ToList();

        var prompt = BuildEvidenceAnalysisPrompt(player, evidence, noEvidence, testableMetrics);
        const string prefill = "{";

        EvidenceAnalysisDto? analysis = null;
        string lastRaw = "";
        for (var attempt = 1; attempt <= 2 && analysis == null; attempt++)
        {
            lastRaw = await _ai.GenerateTextAsync(prompt, maxTokensOverride: 2000,
                modelOverride: "claude-haiku-4-5-20251001", assistantPrefill: prefill);
            try
            {
                analysis = ParseEvidenceAnalysis(lastRaw);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Evidence analysis parse failed (attempt {Attempt})", attempt);
            }
        }

        if (analysis == null)
        {
            _logger.LogError("Failed to parse AI evidence analysis after retries: {Raw}", lastRaw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }

        analysis.PlayerId = playerId;
        analysis.PlayerName = player.FullName;
        _logger.LogInformation("AI evidence analysis generated for player {PlayerId}", playerId);
        return Success(analysis);
    }

    private static string BuildEvidenceAnalysisPrompt(Player p, EvidenceContext evidence,
        List<string> noEvidenceMetrics, List<string> testableMetrics)
    {
        return "You are a sports science data analyst. Review this athlete's evidence quality and advise the coach "
            + "what data to collect next so performance scores become measurement-backed instead of estimated.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + (evidence.HasEvidence
                ? EvidencePromptBlock(evidence)
                : "\nNo evidence recorded yet — every metric is currently unmeasured.\n")
            + (noEvidenceMetrics.Count > 0
                ? $"\nMetrics with NO evidence at all: {string.Join(", ", noEvidenceMetrics)}\n"
                : "")
            + "\nMetrics that support objective tests (with how to measure):\n"
            + string.Join("\n", testableMetrics.Select(m => $"- {m}")) + "\n\n"
            + "Return ONLY a JSON object, no other text:\n"
            + "{\"summary\": string (2-3 sentences on overall evidence quality and the biggest gap), "
            + "\"priorities\": [3-5 of {\"metric\": string (exact metric name), \"action\": string (what to record), "
            + "\"reason\": string (why this metric benefits most, considering their position)}], "
            + "\"testBattery\": [4-6 strings — a concrete test session for this sport/position, e.g. \"30m sprint (timing gates)\"], "
            + "\"roadmap\": [3-5 strings — ordered steps to reach High confidence on the key metrics]}\n\n"
            + "Prioritise metrics that matter most for their position. "
            + "I have pre-started the JSON with { — continue from there and close with }.";
    }

    private static EvidenceAnalysisDto ParseEvidenceAnalysis(string raw)
    {
        var root = JsonDocument.Parse(raw).RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new JsonException("Expected a JSON object for evidence analysis.");

        static List<string> Strings(JsonElement el, string name) =>
            el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array
                ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String)
                    .Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToList()
                : new();

        var dto = new EvidenceAnalysisDto
        {
            Summary = GetStr(root, "summary")?.Trim() ?? "",
            TestBattery = Strings(root, "testBattery"),
            Roadmap = Strings(root, "roadmap"),
        };

        if (root.TryGetProperty("priorities", out var priorities) && priorities.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in priorities.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;
                var metric = GetStr(el, "metric")?.Trim() ?? "";
                if (metric.Length == 0) continue;
                dto.Priorities.Add(new EvidencePriorityDto
                {
                    Metric = metric,
                    Action = GetStr(el, "action")?.Trim() ?? "",
                    Reason = GetStr(el, "reason")?.Trim() ?? "",
                });
            }
        }

        if (dto.Summary.Length == 0 && dto.Priorities.Count == 0)
            throw new JsonException("Evidence analysis had no usable content.");
        return dto;
    }

    // ─── Team Insights ────────────────────────────────────────────────────────

    [HttpPost("team-insights/{teamId}")]
    public async Task<ActionResult> GenerateTeamInsights(int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(User, teamId);

        var team = await _context.Teams
            .Include(t => t.Sport)
            .Include(t => t.Players).ThenInclude(p => p.Position)
            .FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} not found.");

        var playerIds = team.Players.Select(p => p.Id).ToList();

        var assessments = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => playerIds.Contains(a.PlayerId))
            .OrderByDescending(a => a.DateRecorded)
            .ToListAsync();

        var activeInjuryCount = await _context.InjuryRecords
            .Where(i => playerIds.Contains(i.PlayerId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .CountAsync();

        var latestByPlayer = assessments
            .GroupBy(a => a.PlayerId)
            .ToDictionary(g => g.Key, g => g.First());

        var playerSummaryLines = team.Players.Select(p =>
        {
            if (!latestByPlayer.TryGetValue(p.Id, out var a) || !a.StatScores.Any())
                return $"- {p.FullName} ({p.Position.Name}): no assessment data";
            var avg = a.StatScores.Average(s => s.Score);
            var best = a.StatScores.OrderByDescending(s => s.Score).First();
            var worst = a.StatScores.OrderBy(s => s.Score).First();
            return $"- {p.FullName} ({p.Position.Name}): avg {avg:F1}/10, strongest: {best.SportStatCategory.Name} ({best.Score}), weakest: {worst.SportStatCategory.Name} ({worst.Score})";
        });

        var allScores = latestByPlayer.Values.SelectMany(a => a.StatScores).ToList();
        var categoryAvgsText = allScores.Any()
            ? string.Join("\n", allScores
                .GroupBy(s => s.SportStatCategory.Name)
                .Select(g => $"- {g.Key}: {g.Average(s => s.Score):F1}/10"))
            : "- No assessment data available";

        var prompt = BuildTeamInsightsPrompt(team, string.Join("\n", playerSummaryLines), categoryAvgsText, activeInjuryCount);
        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI team insights generated for team {TeamId}", teamId);

        try
        {
            var insights = JsonSerializer.Deserialize<List<string>>(raw) ?? new();
            return Success(new AIInsightsDto { Insights = insights, GeneratedAt = DateTime.UtcNow.ToString("o") });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI team insights: {Raw}", raw);
            return BadRequest(new { success = false, message = "AI returned an unexpected format. Please try again." });
        }
    }

    // ─── Prompt builders ─────────────────────────────────────────────────────

    private static string BuildImprovementPrompt(Player p, string scoresText, string evidenceBlock = "")
    {
        return "You are an elite sports performance coach. Generate a detailed, actionable improvement plan for this athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness Level: {FitnessText(p)}\n\n"
            + "Latest Assessment Scores:\n"
            + scoresText + "\n"
            + evidenceBlock + "\n"
            + $"Athlete Goals: {p.Goals ?? "Not specified"}\n"
            + $"Injury Notes: {p.InjuryNotes ?? "None"}\n\n"
            + (evidenceBlock.Length > 0
                ? "IMPORTANT: Reference the actual measured values in your recommendations and set quantified "
                  + "targets from them (e.g. \"your 30m sprint of 4.0s is good — targeted speed work could reach "
                  + "3.8s, pushing your Speed score from 7.4 to ~8.2\"). Trust evidence-based scores over slider scores.\n\n"
                : "")
            + "Generate a structured improvement plan. Return ONLY a JSON object with exactly these fields, no other text:\n"
            + "{\n"
            + "  \"weeklyGoals\": \"specific weekly targets...\",\n"
            + "  \"trainingRecommendations\": \"3-5 specific training recommendations...\",\n"
            + "  \"skillTargets\": \"which stats to focus on with target scores...\",\n"
            + "  \"sportSpecificDrills\": \"position and sport specific drills...\",\n"
            + "  \"positionFocus\": \"tactical advice for their specific position...\",\n"
            + "  \"coachNotes\": \"overall assessment and motivational notes...\"\n"
            + "}\n\n"
            + "Be specific, use actual score numbers, mention the sport and position. Write as a professional coach would.";
    }

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
            + "Include 3-5 realistic food items per meal with accurate macros for a {p.Sport.Name} athlete.\n"
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

    private static string BuildInsightsPrompt(
        Player p, string assessmentLines, string latestScores, string changeLines, string injuryList, string matchList,
        string evidenceBlock = "")
    {
        return "You are an elite sports analyst. Analyze this athlete's performance data and provide specific insights.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n\n"
            + "Assessment History:\n"
            + (string.IsNullOrWhiteSpace(assessmentLines) ? "- No assessment history" : assessmentLines) + "\n\n"
            + "Latest Scores:\n"
            + (string.IsNullOrWhiteSpace(latestScores) ? "- No scores recorded" : latestScores) + "\n\n"
            + "Score Changes (first vs latest):\n"
            + changeLines + "\n"
            + evidenceBlock + "\n"
            + $"Injuries: {injuryList}\n"
            + $"Recent Matches: {matchList}\n\n"
            + "Provide 4-5 specific, data-driven insights about this athlete's performance. Return ONLY a JSON array of strings:\n"
            + "[\"insight 1...\", \"insight 2...\", \"insight 3...\", \"insight 4...\"]\n\n"
            + "Each insight must:\n"
            + "- Reference actual numbers from the data (prefer measured test values and match stats when present)\n"
            + "- Be specific to their sport and position\n"
            + "- Be actionable and constructive\n"
            + "- Be 1-2 sentences maximum"
            + (evidenceBlock.Contains("weak evidence")
                ? "\nInclude exactly one insight noting which metrics have weak evidence and what data to collect for more accurate analysis."
                : "");
    }

    private static string BuildTeamInsightsPrompt(Team t, string playerLines, string categoryAvgsText, int injuryCount)
    {
        return "You are a head coach analyzing your team's performance.\n\n"
            + $"Team: {t.Name}\n"
            + $"Sport: {t.Sport.Name}\n\n"
            + "Player Performance Summary:\n"
            + playerLines + "\n\n"
            + "Team Averages by Category:\n"
            + categoryAvgsText + "\n\n"
            + $"Active Injuries: {injuryCount} players injured\n\n"
            + "Provide 4-5 team-level insights and recommendations. Return ONLY a JSON array of strings:\n"
            + "[\"insight 1...\", \"insight 2...\", \"insight 3...\", \"insight 4...\"]\n\n"
            + "Focus on team patterns, collective strengths and weaknesses, and strategic recommendations.";
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static string? GetStr(JsonElement el, string key) =>
        el.TryGetProperty(key, out var p) ? p.GetString() : null;

    private static ImprovementPlanDto PlanToDto(ImprovementPlan p) => new()
    {
        Id = p.Id,
        PlayerId = p.PlayerId,
        CreatedDate = p.CreatedDate,
        WeeklyGoals = p.WeeklyGoals,
        TrainingRecommendations = p.TrainingRecommendations,
        SkillTargets = p.SkillTargets,
        SportSpecificDrills = p.SportSpecificDrills,
        PositionFocus = p.PositionFocus,
        CoachNotes = p.CoachNotes,
        IsAIGenerated = p.IsAIGenerated,
    };

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
