using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// CRUD + access control for the four evidence sources and the calculated evidence-based
// scores. All score math lives in EvidenceScoringEngine; this service owns validation,
// ownership checks and DTO mapping.
public interface IEvidenceService
{
    Task<List<SportMetricDefinitionDto>> GetMetricDefinitionsAsync(int sportId);

    Task<ObjectiveTestResultDto> AddObjectiveTestAsync(ClaimsPrincipal user, CreateObjectiveTestDto dto);
    Task<List<ObjectiveTestResultDto>> GetObjectiveTestsAsync(ClaimsPrincipal user, int playerId, int? metricDefinitionId = null);

    Task<MatchStatEntryDto> AddMatchStatsAsync(ClaimsPrincipal user, CreateMatchStatDto dto);
    Task<List<MatchStatEntryDto>> GetMatchStatsAsync(ClaimsPrincipal user, int playerId);

    Task<CoachEvaluationDto> AddCoachEvaluationAsync(ClaimsPrincipal user, CreateCoachEvaluationDto dto);
    Task<List<CoachEvaluationDto>> GetCoachEvaluationsAsync(ClaimsPrincipal user, int playerId);

    Task<SelfAssessmentEntryDto> AddSelfAssessmentAsync(ClaimsPrincipal user, CreateSelfAssessmentDto dto);
    Task<List<SelfAssessmentEntryDto>> GetSelfAssessmentsAsync(ClaimsPrincipal user, int playerId);

    Task<List<EvidenceBasedScoreDto>> GetEvidenceScoresAsync(ClaimsPrincipal user, int playerId);
    Task<List<EvidenceBasedScoreDto>> RecalculateAllAsync(ClaimsPrincipal user, int playerId);
    Task<EvidenceBasedScoreDto?> RecalculateMetricAsync(ClaimsPrincipal user, int playerId, int metricDefinitionId);

    Task<TeamEvidenceStatusDto> GetTeamEvidenceStatusAsync(ClaimsPrincipal user, int teamId);

    Task<List<EvidenceReminderDto>> GetRemindersAsync(ClaimsPrincipal user);
}

public class EvidenceService : IEvidenceService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IEvidenceScoringEngine _engine;

    public EvidenceService(ApplicationDbContext context, IAccessControlService access, IEvidenceScoringEngine engine)
    {
        _context = context;
        _access = access;
        _engine = engine;
    }

    public async Task<List<SportMetricDefinitionDto>> GetMetricDefinitionsAsync(int sportId)
    {
        var defs = await _context.SportMetricDefinitions
            .Where(d => d.SportId == sportId)
            .OrderBy(d => d.Category).ThenBy(d => d.Name)
            .ToListAsync();
        return defs.Select(ToDefinitionDto).ToList();
    }

    // ─── Objective tests ─────────────────────────────────────────────────────

    public async Task<ObjectiveTestResultDto> AddObjectiveTestAsync(ClaimsPrincipal user, CreateObjectiveTestDto dto)
    {
        var def = await RequireMetricForPlayerAsync(user, dto.PlayerId, dto.MetricDefinitionId,
            p => p.CanAssessPlayers);

        if (def.InputType == MetricInputType.Rating && (dto.Value < 1 || dto.Value > 10))
            throw new ValidationApiException("Rating values must be between 1 and 10.");
        if (dto.Value < 0)
            throw new ValidationApiException("Test value cannot be negative.");
        if (dto.TestedAt is DateTime testedAt && testedAt > DateTime.UtcNow.AddDays(1))
            throw new ValidationApiException("Test date cannot be in the future.");

        var isAthlete = user.IsInRole("Athlete") || _access.IsSoloAthlete(user);
        var test = new ObjectiveTestResult
        {
            PlayerId = dto.PlayerId,
            MetricDefinitionId = def.Id,
            Value = dto.Value,
            Unit = dto.Unit ?? def.Unit ?? "",
            TestedAt = dto.TestedAt ?? DateTime.UtcNow,
            TestedBy = isAthlete ? TestedByType.Athlete : TestedByType.Coach,
            Notes = dto.Notes,
            AssessmentId = dto.AssessmentId,
        };
        _context.ObjectiveTestResults.Add(test);
        await _context.SaveChangesAsync();

        var overrides = await _engine.GetBenchmarkOverridesAsync(dto.PlayerId);
        return ToTestDto(test, def, Override(overrides, def.Id));
    }

    public async Task<List<ObjectiveTestResultDto>> GetObjectiveTestsAsync(ClaimsPrincipal user, int playerId, int? metricDefinitionId = null)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var query = _context.ObjectiveTestResults
            .Include(t => t.MetricDefinition)
            .Where(t => t.PlayerId == playerId);
        if (metricDefinitionId is int metricId)
            query = query.Where(t => t.MetricDefinitionId == metricId);

        var tests = await query.OrderByDescending(t => t.TestedAt).ToListAsync();
        var overrides = await _engine.GetBenchmarkOverridesAsync(playerId);
        return tests.Select(t => ToTestDto(t, t.MetricDefinition, Override(overrides, t.MetricDefinitionId))).ToList();
    }

    private static (decimal, decimal, decimal)? Override(
        Dictionary<int, (decimal Low, decimal Mid, decimal High)> overrides, int metricId) =>
        overrides.TryGetValue(metricId, out var o) ? o : null;

    // ─── Match stats ─────────────────────────────────────────────────────────

    public async Task<MatchStatEntryDto> AddMatchStatsAsync(ClaimsPrincipal user, CreateMatchStatDto dto)
    {
        await _access.EnsurePlayerPermissionAsync(user, dto.PlayerId, p => p.CanAssessPlayers,
            "You don't have permission to record match stats for this player.");

        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == dto.PlayerId)
            ?? throw new NotFoundApiException($"Player {dto.PlayerId} was not found.");

        if (dto.Stats.Count == 0)
            throw new ValidationApiException("At least one stat value is required.");
        if (dto.Stats.Any(s => s.Value < 0))
            throw new ValidationApiException("Stat values cannot be negative.");

        if (dto.MatchResultId is int matchId)
        {
            var matchExists = await _context.MatchResults.AnyAsync(m => m.Id == matchId);
            if (!matchExists)
                throw new ValidationApiException($"Match result {matchId} does not exist.");
        }

        var entry = new MatchStatEntry
        {
            PlayerId = dto.PlayerId,
            MatchResultId = dto.MatchResultId,
            StatDate = dto.StatDate ?? DateTime.UtcNow,
            SportId = player.SportId,
            StatsJson = JsonSerializer.Serialize(dto.Stats),
            Notes = dto.Notes,
        };
        _context.MatchStatEntries.Add(entry);
        await _context.SaveChangesAsync();

        return ToMatchStatDto(entry);
    }

    public async Task<List<MatchStatEntryDto>> GetMatchStatsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var entries = await _context.MatchStatEntries
            .Where(m => m.PlayerId == playerId)
            .OrderByDescending(m => m.StatDate)
            .ToListAsync();
        return entries.Select(ToMatchStatDto).ToList();
    }

    // ─── Coach evaluations ───────────────────────────────────────────────────

    public async Task<CoachEvaluationDto> AddCoachEvaluationAsync(ClaimsPrincipal user, CreateCoachEvaluationDto dto)
    {
        var def = await RequireMetricForPlayerAsync(user, dto.PlayerId, dto.MetricDefinitionId,
            p => p.CanAssessPlayers);
        ValidateRating(dto.Rating);

        var eval = new CoachEvaluation
        {
            PlayerId = dto.PlayerId,
            CoachId = _access.RequireUserId(user),
            MetricDefinitionId = def.Id,
            Rating = dto.Rating,
            EvalDate = dto.EvalDate ?? DateTime.UtcNow,
            Notes = dto.Notes,
            AssessmentId = dto.AssessmentId,
        };
        _context.CoachEvaluations.Add(eval);
        await _context.SaveChangesAsync();

        return ToCoachEvalDto(eval, def);
    }

    public async Task<List<CoachEvaluationDto>> GetCoachEvaluationsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var evals = await _context.CoachEvaluations
            .Include(e => e.MetricDefinition)
            .Where(e => e.PlayerId == playerId)
            .OrderByDescending(e => e.EvalDate)
            .ToListAsync();
        return evals.Select(e => ToCoachEvalDto(e, e.MetricDefinition)).ToList();
    }

    // ─── Self-assessments ────────────────────────────────────────────────────

    public async Task<SelfAssessmentEntryDto> AddSelfAssessmentAsync(ClaimsPrincipal user, CreateSelfAssessmentDto dto)
    {
        // Always the caller's own player — athletes can never self-assess someone else.
        var player = await _access.RequireOwnPlayerAsync(user);
        var def = await _context.SportMetricDefinitions
                .FirstOrDefaultAsync(d => d.Id == dto.MetricDefinitionId)
            ?? throw new NotFoundApiException($"Metric definition {dto.MetricDefinitionId} was not found.");
        if (def.SportId != player.SportId)
            throw new ValidationApiException("This metric belongs to a different sport.");
        ValidateRating(dto.Rating);

        var entry = new SelfAssessmentEntry
        {
            PlayerId = player.Id,
            MetricDefinitionId = def.Id,
            Rating = dto.Rating,
            EvalDate = dto.EvalDate ?? DateTime.UtcNow,
            GuidedAnswers = dto.GuidedAnswers,
            Notes = dto.Notes,
            AssessmentId = dto.AssessmentId,
        };
        _context.SelfAssessmentEntries.Add(entry);
        await _context.SaveChangesAsync();

        return ToSelfAssessmentDto(entry, def);
    }

    public async Task<List<SelfAssessmentEntryDto>> GetSelfAssessmentsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var entries = await _context.SelfAssessmentEntries
            .Include(e => e.MetricDefinition)
            .Where(e => e.PlayerId == playerId)
            .OrderByDescending(e => e.EvalDate)
            .ToListAsync();
        return entries.Select(e => ToSelfAssessmentDto(e, e.MetricDefinition)).ToList();
    }

    // ─── Evidence-based scores ───────────────────────────────────────────────

    public async Task<List<EvidenceBasedScoreDto>> GetEvidenceScoresAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var scores = await _context.EvidenceBasedScores
            .Include(s => s.MetricDefinition)
            .Where(s => s.PlayerId == playerId && s.AssessmentId == null)
            .ToListAsync();
        return scores.Select(ToScoreDto).OrderBy(s => s.MetricName).ToList();
    }

    public async Task<List<EvidenceBasedScoreDto>> RecalculateAllAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var scores = await _engine.RecalculateAllAsync(playerId);

        // The engine returns bare rows; attach definitions for DTO mapping.
        var defIds = scores.Select(s => s.MetricDefinitionId).ToList();
        var defs = await _context.SportMetricDefinitions
            .Where(d => defIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id);
        foreach (var s in scores)
            s.MetricDefinition = defs[s.MetricDefinitionId];

        return scores.Select(ToScoreDto).OrderBy(s => s.MetricName).ToList();
    }

    public async Task<EvidenceBasedScoreDto?> RecalculateMetricAsync(ClaimsPrincipal user, int playerId, int metricDefinitionId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var score = await _engine.CalculateScoreAsync(playerId, metricDefinitionId);
        if (score == null) return null;

        score.MetricDefinition = await _context.SportMetricDefinitions
            .FirstAsync(d => d.Id == metricDefinitionId);
        return ToScoreDto(score);
    }

    // ─── Team evidence status ────────────────────────────────────────────────

    // Which players have real evidence behind their scores and which need a test day —
    // powers the team-detail "Evidence" tab.
    public async Task<TeamEvidenceStatusDto> GetTeamEvidenceStatusAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);

        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        var players = await _context.Players
            .Where(p => p.TeamId == teamId)
            .OrderBy(p => p.FullName)
            .ToListAsync();
        var playerIds = players.Select(p => p.Id).ToList();

        var totalMetrics = await _context.SportMetricDefinitions
            .CountAsync(d => d.SportId == team.SportId);

        var scores = await _context.EvidenceBasedScores
            .Where(s => playerIds.Contains(s.PlayerId) && s.AssessmentId == null)
            .ToListAsync();
        var tests = await _context.ObjectiveTestResults
            .Where(t => playerIds.Contains(t.PlayerId))
            .GroupBy(t => t.PlayerId)
            .Select(g => new { PlayerId = g.Key, Count = g.Count(), Last = g.Max(t => t.TestedAt) })
            .ToListAsync();
        var matchStats = await _context.MatchStatEntries
            .Where(m => playerIds.Contains(m.PlayerId))
            .GroupBy(m => m.PlayerId)
            .Select(g => new { PlayerId = g.Key, Count = g.Count() })
            .ToListAsync();

        var scoresByPlayer = scores.GroupBy(s => s.PlayerId).ToDictionary(g => g.Key, g => g.ToList());
        var testsByPlayer = tests.ToDictionary(x => x.PlayerId);
        var matchByPlayer = matchStats.ToDictionary(x => x.PlayerId, x => x.Count);
        var recentCutoff = DateTime.UtcNow.AddDays(-30);

        var rows = players.Select(p =>
        {
            var playerScores = scoresByPlayer.GetValueOrDefault(p.Id) ?? new List<EvidenceBasedScore>();
            var confidence = playerScores.Count == 0
                ? (EvidenceConfidence?)null
                : playerScores.GroupBy(s => s.Confidence)
                    .OrderByDescending(g => g.Count()).ThenByDescending(g => g.Key)
                    .First().Key;
            testsByPlayer.TryGetValue(p.Id, out var t);
            return new PlayerEvidenceStatusDto
            {
                PlayerId = p.Id,
                PlayerName = p.FullName,
                JerseyNumber = p.JerseyNumber,
                ScoredMetrics = playerScores.Count,
                VerifiedMetrics = playerScores.Count(s => s.Confidence is EvidenceConfidence.High or EvidenceConfidence.VeryHigh),
                OverallConfidence = confidence?.ToString(),
                LastTestAt = t?.Last,
                TestCount = t?.Count ?? 0,
                MatchStatCount = matchByPlayer.GetValueOrDefault(p.Id),
            };
        }).ToList();

        return new TeamEvidenceStatusDto
        {
            TeamId = teamId,
            TotalMetrics = totalMetrics,
            Players = rows,
            PlayersNeedingTests = rows.Count(r => r.LastTestAt == null || r.LastTestAt < recentCutoff),
            PlayersWithoutMatchStats = rows.Count(r => r.MatchStatCount == 0),
            PlayersWithoutEvidence = rows.Count(r => r.ScoredMetrics == 0),
        };
    }

    // ─── Evidence reminders ──────────────────────────────────────────────────

    // Coach-dashboard nudges: tracked players (those with evidence scores) whose objective
    // tests are stale or missing, plus one aggregate item for players whose scores are
    // mostly Low-confidence estimates.
    public async Task<List<EvidenceReminderDto>> GetRemindersAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        if (teamIds.Count == 0) return new();

        var players = await _context.Players
            .Include(p => p.Team)
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value))
            .ToListAsync();
        var playerIds = players.Select(p => p.Id).ToList();

        var scores = await _context.EvidenceBasedScores
            .Where(s => playerIds.Contains(s.PlayerId) && s.AssessmentId == null)
            .Select(s => new { s.PlayerId, s.Confidence })
            .ToListAsync();
        var lastTests = await _context.ObjectiveTestResults
            .Where(t => playerIds.Contains(t.PlayerId))
            .GroupBy(t => t.PlayerId)
            .Select(g => new { PlayerId = g.Key, Last = g.Max(t => t.TestedAt) })
            .ToDictionaryAsync(x => x.PlayerId, x => x.Last);

        var scoredPlayerIds = scores.Select(s => s.PlayerId).ToHashSet();
        var now = DateTime.UtcNow;
        var reminders = new List<EvidenceReminderDto>();

        // Stale/missing tests — only for players already being tracked with evidence.
        var stale = players
            .Where(p => scoredPlayerIds.Contains(p.Id))
            .Select(p =>
            {
                lastTests.TryGetValue(p.Id, out var last);
                var days = last == default ? (int?)null : (int)(now - last).TotalDays;
                return (Player: p, Days: days);
            })
            .Where(x => x.Days == null || x.Days >= 30)
            .OrderByDescending(x => x.Days ?? int.MaxValue)
            .Take(5);

        foreach (var (p, days) in stale)
        {
            reminders.Add(new EvidenceReminderDto
            {
                Type = "NoRecentTest",
                PlayerId = p.Id,
                PlayerName = p.FullName,
                TeamId = p.TeamId,
                TeamName = p.Team?.Name,
                DaysSinceTest = days,
            });
        }

        var lowConfidencePlayers = scores
            .GroupBy(s => s.PlayerId)
            .Count(g => g.Count(s => s.Confidence == EvidenceConfidence.Low) >= 2);
        if (lowConfidencePlayers > 0)
        {
            reminders.Add(new EvidenceReminderDto
            {
                Type = "LowConfidence",
                Count = lowConfidencePlayers,
            });
        }

        return reminders;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    // Access check (with assistant-coach permission gate) + metric must belong to the
    // player's sport.
    private async Task<SportMetricDefinition> RequireMetricForPlayerAsync(
        ClaimsPrincipal user, int playerId, int metricDefinitionId,
        Func<CoachPermissions, bool> permission)
    {
        await _access.EnsurePlayerPermissionAsync(user, playerId, permission,
            "You don't have permission to record evidence for this player.");

        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");
        var def = await _context.SportMetricDefinitions
                .FirstOrDefaultAsync(d => d.Id == metricDefinitionId)
            ?? throw new NotFoundApiException($"Metric definition {metricDefinitionId} was not found.");
        if (def.SportId != player.SportId)
            throw new ValidationApiException("This metric belongs to a different sport.");
        return def;
    }

    private static void ValidateRating(decimal rating)
    {
        if (rating < 1 || rating > 10)
            throw new ValidationApiException("Rating must be between 1 and 10.");
    }

    private static SportMetricDefinitionDto ToDefinitionDto(SportMetricDefinition d) => new()
    {
        Id = d.Id,
        SportId = d.SportId,
        Name = d.Name,
        ShortName = d.ShortName,
        Category = d.Category.ToString(),
        Description = d.Description,
        Unit = d.Unit,
        InputType = d.InputType.ToString(),
        ObjectiveTestWeight = d.ObjectiveTestWeight,
        MatchStatWeight = d.MatchStatWeight,
        CoachEvalWeight = d.CoachEvalWeight,
        SelfAssessWeight = d.SelfAssessWeight,
        IsObjectiveRequired = d.IsObjectiveRequired,
        BenchmarkLow = d.BenchmarkLow,
        BenchmarkMid = d.BenchmarkMid,
        BenchmarkHigh = d.BenchmarkHigh,
        Notes = d.Notes,
        SportStatCategoryId = d.SportStatCategoryId,
        SupportsMatchStats = EvidenceScoringEngine.HasMatchStatRule(d.SportId, d.Name),
        TestSetup = d.TestSetup,
        TestProcedure = d.TestProcedure,
        CommonMistakes = d.CommonMistakes,
        VideoUrl = d.VideoUrl,
    };

    private static ObjectiveTestResultDto ToTestDto(ObjectiveTestResult t, SportMetricDefinition def,
        (decimal, decimal, decimal)? benchmarkOverride = null) => new()
    {
        Id = t.Id,
        PlayerId = t.PlayerId,
        MetricDefinitionId = t.MetricDefinitionId,
        MetricName = def.Name,
        Value = t.Value,
        Unit = t.Unit,
        TestedAt = t.TestedAt,
        TestedBy = t.TestedBy.ToString(),
        Notes = t.Notes,
        AssessmentId = t.AssessmentId,
        NormalizedScore = EvidenceScoringEngine.NormalizeObjectiveValue(t.Value, def, benchmarkOverride),
    };

    private static MatchStatEntryDto ToMatchStatDto(MatchStatEntry m) => new()
    {
        Id = m.Id,
        PlayerId = m.PlayerId,
        MatchResultId = m.MatchResultId,
        StatDate = m.StatDate,
        SportId = m.SportId,
        Stats = EvidenceScoringEngine.ParseStatsJson(m.StatsJson),
        Notes = m.Notes,
        IsAutoImported = m.IsAutoImported,
    };

    private static CoachEvaluationDto ToCoachEvalDto(CoachEvaluation e, SportMetricDefinition def) => new()
    {
        Id = e.Id,
        PlayerId = e.PlayerId,
        MetricDefinitionId = e.MetricDefinitionId,
        MetricName = def.Name,
        Rating = e.Rating,
        EvalDate = e.EvalDate,
        Notes = e.Notes,
        AssessmentId = e.AssessmentId,
    };

    private static SelfAssessmentEntryDto ToSelfAssessmentDto(SelfAssessmentEntry e, SportMetricDefinition def) => new()
    {
        Id = e.Id,
        PlayerId = e.PlayerId,
        MetricDefinitionId = e.MetricDefinitionId,
        MetricName = def.Name,
        Rating = e.Rating,
        EvalDate = e.EvalDate,
        GuidedAnswers = e.GuidedAnswers,
        Notes = e.Notes,
    };

    private static EvidenceBasedScoreDto ToScoreDto(EvidenceBasedScore s)
    {
        var def = s.MetricDefinition;
        List<string> sources;
        try
        {
            sources = JsonSerializer.Deserialize<List<string>>(s.EvidenceSources) ?? new();
        }
        catch (JsonException)
        {
            sources = new();
        }

        return new EvidenceBasedScoreDto
        {
            Id = s.Id,
            PlayerId = s.PlayerId,
            MetricDefinitionId = s.MetricDefinitionId,
            MetricName = def.Name,
            MetricCategory = def.Category.ToString(),
            SportStatCategoryId = def.SportStatCategoryId,
            AssessmentId = s.AssessmentId,
            FinalScore = s.FinalScore,
            Confidence = s.Confidence.ToString(),
            CalculationMethod = s.CalculationMethod.ToString(),
            ObjectiveScore = s.ObjectiveScore,
            MatchStatScore = s.MatchStatScore,
            CoachEvalScore = s.CoachEvalScore,
            SelfAssessScore = s.SelfAssessScore,
            ObjectiveWeight = s.ObjectiveWeight,
            MatchStatWeight = s.MatchStatWeight,
            CoachEvalWeight = s.CoachEvalWeight,
            SelfAssessWeight = s.SelfAssessWeight,
            EvidenceSources = sources,
            Explanation = s.Explanation,
            MissingEvidence = EvidenceScoringEngine.MissingEvidence(def,
                s.ObjectiveScore != null, s.MatchStatScore != null,
                s.CoachEvalScore != null, s.SelfAssessScore != null),
            LastCalculatedAt = s.LastCalculatedAt,
        };
    }
}
