using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/ai")]
[Authorize(Roles = "Coach,Admin")]
public class AIController : ApiControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly ILogger<AIController> _logger;

    public AIController(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        ILogger<AIController> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _logger = logger;
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

        var prompt = BuildImprovementPrompt(player, scoresText);

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
            var outputText = $"{mealSuggestions} {foodsToPrioritize}".ToLowerInvariant();
            var flagged = hardKeywords.Where(k => outputText.Contains(k)).ToList();
            var extraNote = flagged.Any()
                ? $"\n\n⚠️ Coach review required: AI output may reference restricted items ({string.Join(", ", flagged)}). Please verify before using."
                : "";

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

        var prompt = BuildInsightsPrompt(player, assessmentLines, latestScores, changeLines, injuryList, matchList);
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

    private static string BuildImprovementPrompt(Player p, string scoresText)
    {
        return "You are an elite sports performance coach. Generate a detailed, actionable improvement plan for this athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + $"Fitness Level: {p.FitnessLevel}/10\n\n"
            + "Latest Assessment Scores:\n"
            + scoresText + "\n\n"
            + $"Athlete Goals: {p.Goals ?? "Not specified"}\n"
            + $"Injury Notes: {p.InjuryNotes ?? "None"}\n\n"
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
        return "You are a professional sports nutritionist. Generate personalized nutrition guidance for this athlete.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n\n"
            + "DIETARY RESTRICTIONS (MUST BE RESPECTED):\n"
            + restrictionBlock + "\n\n"
            + "Generate personalized nutrition guidance. Return ONLY a JSON object with exactly these fields, no other text:\n"
            + "{\n"
            + "  \"goal\": \"primary nutrition goal for this athlete...\",\n"
            + "  \"mealSuggestions\": \"specific meal ideas for breakfast, lunch, dinner...\",\n"
            + "  \"hydrationTips\": \"specific hydration recommendations...\",\n"
            + "  \"recoveryTips\": \"post-training recovery nutrition...\",\n"
            + "  \"foodsToPrioritize\": \"comma-separated list of recommended foods...\",\n"
            + "  \"foodsToLimit\": \"comma-separated list of foods to avoid...\"\n"
            + "}\n\n"
            + "CRITICAL: Never suggest foods that conflict with the hard allergies or lifestyle restrictions listed above.\n"
            + $"Write specific, practical advice for a {p.Sport.Name} athlete.";
    }

    private static string BuildInsightsPrompt(
        Player p, string assessmentLines, string latestScores, string changeLines, string injuryList, string matchList)
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
            + changeLines + "\n\n"
            + $"Injuries: {injuryList}\n"
            + $"Recent Matches: {matchList}\n\n"
            + "Provide 4-5 specific, data-driven insights about this athlete's performance. Return ONLY a JSON array of strings:\n"
            + "[\"insight 1...\", \"insight 2...\", \"insight 3...\", \"insight 4...\"]\n\n"
            + "Each insight must:\n"
            + "- Reference actual numbers from the data\n"
            + "- Be specific to their sport and position\n"
            + "- Be actionable and constructive\n"
            + "- Be 1-2 sentences maximum";
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
    };
}
