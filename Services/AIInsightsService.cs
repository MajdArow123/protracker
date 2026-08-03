using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAIInsightsService
{
    Task<AIInsightsDto> GeneratePerformanceInsightsAsync(ClaimsPrincipal user, int playerId);
    Task<EvidenceAnalysisDto> GenerateEvidenceAnalysisAsync(ClaimsPrincipal user, int playerId);
    Task<AIInsightsDto> GenerateTeamInsightsAsync(ClaimsPrincipal user, int teamId);
}

// AI analysis endpoints: player performance insights, evidence-quality analysis
// (Phase G), and team-level insights. Prompt construction and response parsing
// live here — the controller only routes and delegates.
public class AIInsightsService : IAIInsightsService
{
    private readonly ApplicationDbContext _context;
    private readonly IAIService _ai;
    private readonly IAccessControlService _access;
    private readonly IAIEvidenceContextService _evidence;
    private readonly ILogger<AIInsightsService> _logger;

    public AIInsightsService(
        ApplicationDbContext context,
        IAIService ai,
        IAccessControlService access,
        IAIEvidenceContextService evidence,
        ILogger<AIInsightsService> logger)
    {
        _context = context;
        _ai = ai;
        _access = access;
        _evidence = evidence;
        _logger = logger;
    }

    // ─── Performance Insights ─────────────────────────────────────────────────

    public async Task<AIInsightsDto> GeneratePerformanceInsightsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

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

        var evidence = await _evidence.BuildAsync(playerId);
        var prompt = BuildInsightsPrompt(player, assessmentLines, latestScores, changeLines, injuryList, matchList,
            AIEvidenceContextService.PromptBlock(evidence));
        var raw = await _ai.GenerateTextAsync(prompt);
        _logger.LogInformation("AI performance insights generated for player {PlayerId}", playerId);

        try
        {
            var insights = JsonSerializer.Deserialize<List<string>>(raw) ?? new();
            return new AIInsightsDto { Insights = insights, GeneratedAt = DateTime.UtcNow.ToString("o") };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI insights: {Raw}", raw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }
    }

    // ─── Evidence Analysis (Phase G) ─────────────────────────────────────────

    // AI review of the player's evidence quality: what's missing, which metrics would
    // benefit most from objective tests, a recommended test battery for the sport/
    // position, and a confidence-improvement roadmap. Stateless (nothing persisted).
    public async Task<EvidenceAnalysisDto> GenerateEvidenceAnalysisAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} not found.");

        var defs = await _context.SportMetricDefinitions
            .Where(d => d.SportId == player.SportId)
            .ToListAsync();
        var evidence = await _evidence.BuildAsync(playerId);

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
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }

        analysis.PlayerId = playerId;
        analysis.PlayerName = player.FullName;
        _logger.LogInformation("AI evidence analysis generated for player {PlayerId}", playerId);
        return analysis;
    }

    // ─── Team Insights ────────────────────────────────────────────────────────

    public async Task<AIInsightsDto> GenerateTeamInsightsAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);

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
            return new AIInsightsDto { Insights = insights, GeneratedAt = DateTime.UtcNow.ToString("o") };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse AI team insights: {Raw}", raw);
            throw new BadRequestApiException("AI returned an unexpected format. Please try again.");
        }
    }

    // ─── Prompt builders ─────────────────────────────────────────────────────

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

    private static string BuildEvidenceAnalysisPrompt(Player p, AIEvidenceContext evidence,
        List<string> noEvidenceMetrics, List<string> testableMetrics)
    {
        return "You are a sports science data analyst. Review this athlete's evidence quality and advise the coach "
            + "what data to collect next so performance scores become measurement-backed instead of estimated.\n\n"
            + $"Athlete: {p.FullName}\n"
            + $"Sport: {p.Sport.Name}\n"
            + $"Position: {p.Position.Name}\n"
            + $"Age: {p.Age}\n"
            + (evidence.HasEvidence
                ? AIEvidenceContextService.PromptBlock(evidence)
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

    // ─── Parsers ─────────────────────────────────────────────────────────────

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

    private static string? GetStr(JsonElement el, string key) =>
        el.TryGetProperty(key, out var p) ? p.GetString() : null;
}
