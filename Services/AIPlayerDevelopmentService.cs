using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAIPlayerDevelopmentService
{
    Task<ImprovementPlanDto> GenerateImprovementPlanAsync(ClaimsPrincipal user, int playerId);
    Task<TaskSuggestionsDto> GenerateTaskSuggestionsAsync(ClaimsPrincipal user, int playerId);
    Task<GoalSuggestionsDto> GenerateGoalSuggestionsAsync(ClaimsPrincipal user, int playerId);
    Task<DrillRecommendationsDto> GenerateDrillRecommendationsAsync(ClaimsPrincipal user, int playerId);
}

// AI player-development generation: improvement plans, task/goal suggestions, and
// drill recommendations. Prompt construction and response parsing live here — the
// controller only routes and delegates.
public class AIPlayerDevelopmentService : IAIPlayerDevelopmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly IAIEvidenceContextService _evidence;
    private readonly IDrillService _drills;
    private readonly ILogger<AIPlayerDevelopmentService> _logger;

    public AIPlayerDevelopmentService(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        IAIEvidenceContextService evidence,
        IDrillService drills,
        ILogger<AIPlayerDevelopmentService> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _evidence = evidence;
        _drills = drills;
        _logger = logger;
    }

    // ─── Improvement Plan ────────────────────────────────────────────────────

    public async Task<ImprovementPlanDto> GenerateImprovementPlanAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await LoadPlayerAsync(playerId);
        var latestAssessment = await LoadLatestAssessmentAsync(playerId);

        var scoreLines = latestAssessment?.StatScores
            .Select(s => $"- {s.SportStatCategory.Name}: {s.Score}/10")
            ?? Enumerable.Empty<string>();

        var scoresText = scoreLines.Any()
            ? string.Join("\n", scoreLines)
            : "- No assessment data yet";

        var evidence = await _evidence.BuildAsync(playerId);
        var prompt = BuildImprovementPrompt(player, scoresText, AIEvidenceContextService.PromptBlock(evidence));

        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI improvement plan generated for player {PlayerId}", playerId);

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
            return PlanToDto(plan);
        }
        catch (Exception ex) when (ex is not BadRequestApiException)
        {
            _logger.LogError(ex, "Failed to parse AI improvement plan: {Raw}", raw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }
    }

    // ─── Task Suggestions ─────────────────────────────────────────────────────

    public async Task<TaskSuggestionsDto> GenerateTaskSuggestionsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await LoadPlayerAsync(playerId);
        var latestAssessment = await LoadLatestAssessmentAsync(playerId);

        // Weakest areas drive the suggestions. Evidence-based scores (weighted from real
        // tests/matches) are preferred when the player has enough of them; slider scores
        // are the fallback so players without evidence keep working exactly as before.
        var evidence = await _evidence.BuildAsync(playerId);
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

        var prompt = BuildTaskSuggestionsPrompt(player, weakAreasText, AIEvidenceContextService.PromptBlock(evidence));
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
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        _logger.LogInformation("AI task suggestions generated for player {PlayerId}", playerId);
        return new TaskSuggestionsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Suggestions = suggestions,
        };
    }

    // ─── Goal Suggestions ─────────────────────────────────────────────────────

    // Suggests SMART goals from the player's weakest assessment areas + sport/position.
    // Each suggestion is linked back to its stat category so accepting it enables
    // assessment auto-tracking.
    public async Task<GoalSuggestionsDto> GenerateGoalSuggestionsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await LoadPlayerAsync(playerId);
        var latestAssessment = await LoadLatestAssessmentAsync(playerId);

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
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        _logger.LogInformation("AI goal suggestions generated for player {PlayerId}", playerId);
        return new GoalSuggestionsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Suggestions = suggestions,
        };
    }

    // ─── Drill Recommendations ────────────────────────────────────────────────

    // Recommends drills from the library for the player's weakest assessment areas,
    // ranked and explained by Claude. Sport-aware.
    public async Task<DrillRecommendationsDto> GenerateDrillRecommendationsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await LoadPlayerAsync(playerId);
        var latestAssessment = await LoadLatestAssessmentAsync(playerId);

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
            throw new BadRequestApiException("No drills are available for this sport yet.");

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
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        // Fetch full drill data (order preserved) and attach reasoning.
        var dtos = await _drills.GetManyAsync(user, recs.Select(r => r.Id));
        var byId = recs.ToDictionary(r => r.Id);
        var items = dtos.Select(d =>
        {
            var r = byId[d.Id];
            d.RecommendReason = r.Reason;
            d.RecommendTarget = r.Target;
            return new DrillRecommendationItemDto { Drill = d, Reasoning = r.Reason, TargetCategory = r.Target, Priority = r.Priority };
        }).ToList();

        _logger.LogInformation("AI drill recommendations generated for player {PlayerId}", playerId);
        return new DrillRecommendationsDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            WeakAreas = weakAreas,
            Recommendations = items,
        };
    }

    // ─── Shared lookups ──────────────────────────────────────────────────────

    private async Task<Player> LoadPlayerAsync(int playerId) =>
        await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
        ?? throw new NotFoundApiException($"Player {playerId} not found.");

    private Task<PlayerAssessment?> LoadLatestAssessmentAsync(int playerId) =>
        _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();

    // ─── Prompt builders ─────────────────────────────────────────────────────

    private static string BuildImprovementPrompt(Player p, string scoresText, string evidenceBlock = "")
    {
        return "You are an elite sports performance coach. Generate a detailed, actionable improvement plan for this athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness Level: {AIEvidenceContextService.FitnessText(p)}\n\n"
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

    private static string BuildTaskSuggestionsPrompt(Player p, string weakAreasText, string evidenceBlock = "")
    {
        return "You are an elite sports performance coach. Suggest 5 concrete, assignable tasks/drills to help "
            + "this athlete improve their weakest areas. The coach will assign these directly to the athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness level: {AIEvidenceContextService.FitnessText(p)}\n\n"
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

    private static string BuildGoalSuggestionsPrompt(Player p, string weakAreasText)
    {
        return "You are an elite sports performance coach. Suggest 4 specific, measurable personal goals "
            + "to help this athlete improve, based on their weakest assessment areas. Goals should be "
            + "achievable in the given timeline and motivating.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness level: {AIEvidenceContextService.FitnessText(p)}\n\n"
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

    // ─── Parsers ─────────────────────────────────────────────────────────────

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
}
