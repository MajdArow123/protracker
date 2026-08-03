using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

// Real evidence data injected into AI prompts: calculated scores with confidence,
// raw measured test values, and match stat trends. Empty sections are omitted so
// prompts for players without evidence stay unchanged.
public sealed record AIEvidenceContext(
    string ScoresText, string TestsText, string MatchTrendText,
    List<string> LowConfidenceMetrics, bool HasEvidence,
    List<EvidenceBasedScore> Scores);

public interface IAIEvidenceContextService
{
    Task<AIEvidenceContext> BuildAsync(int playerId);
}

// Shared by every AI domain service (Phase G): builds the evidence context once and
// renders the prompt block/fitness line consistently across all prompts.
public class AIEvidenceContextService : IAIEvidenceContextService
{
    private readonly ApplicationDbContext _context;

    public AIEvidenceContextService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AIEvidenceContext> BuildAsync(int playerId)
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

        return new AIEvidenceContext(scoresText, testsText, matchTrendText, lowConfidence,
            scores.Count > 0 || tests.Count > 0 || matchEntries.Count > 0, scores);
    }

    // Honest fitness line for prompts: never fabricate a value for players
    // whose fitness was never recorded (nullable since the tactical layer).
    public static string FitnessText(Player p) =>
        p.FitnessLevel is int f ? $"{f}/10" : "not recorded";

    // The evidence sections appended to prompts (empty string when no evidence exists).
    public static string PromptBlock(AIEvidenceContext e)
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
}
