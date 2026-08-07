using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Evidence-based assessment system: sport metric definitions, the four evidence sources
// (objective tests, match stats, coach evaluations, self-assessments) and the calculated
// evidence-based scores. Slider assessments keep working unchanged — evidence is an
// additive layer (see EvidenceScoringEngine).
[Route("api")]
public class EvidenceController : ApiControllerBase
{
    private readonly IEvidenceService _service;

    public EvidenceController(IEvidenceService service)
    {
        _service = service;
    }

    // All metric definitions for a sport (any authenticated role — drives the entry UI).
    [HttpGet("sport-metrics/{sportId}")]
    public async Task<ActionResult> GetSportMetrics(int sportId)
        => Success(await _service.GetMetricDefinitionsAsync(sportId));

    // ─── Objective tests ─────────────────────────────────────────────────────

    // Coaches record tests for their players; athletes/solo athletes for themselves.
    [HttpPost("objective-tests")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete,Athlete")]
    public async Task<ActionResult> AddObjectiveTest(CreateObjectiveTestDto dto)
        => Created(await _service.AddObjectiveTestAsync(User, dto));

    [HttpGet("players/{playerId}/objective-tests")]
    public async Task<ActionResult> GetObjectiveTests(int playerId, [FromQuery] int? metricId = null, [FromQuery] int? seasonId = null)
        => Success(await _service.GetObjectiveTestsAsync(User, playerId, metricId, seasonId));

    // ─── Match stats ─────────────────────────────────────────────────────────

    [HttpPost("match-stats")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> AddMatchStats(CreateMatchStatDto dto)
        => Created(await _service.AddMatchStatsAsync(User, dto));

    [HttpGet("players/{playerId}/match-stats")]
    public async Task<ActionResult> GetMatchStats(int playerId)
        => Success(await _service.GetMatchStatsAsync(User, playerId));

    // ─── Coach evaluations ───────────────────────────────────────────────────

    // Coach-only: solo athletes' subjective input is a self-assessment, never a coach
    // evaluation, so confidence honestly reflects who rated it.
    [HttpPost("coach-evaluations")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> AddCoachEvaluation(CreateCoachEvaluationDto dto)
        => Created(await _service.AddCoachEvaluationAsync(User, dto));

    [HttpGet("players/{playerId}/coach-evaluations")]
    public async Task<ActionResult> GetCoachEvaluations(int playerId)
        => Success(await _service.GetCoachEvaluationsAsync(User, playerId));

    // ─── Self-assessments ────────────────────────────────────────────────────

    [HttpPost("self-assessments/evidence")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> AddSelfAssessment(CreateSelfAssessmentDto dto)
        => Created(await _service.AddSelfAssessmentAsync(User, dto));

    [HttpGet("players/{playerId}/self-assessments")]
    public async Task<ActionResult> GetSelfAssessments(int playerId)
        => Success(await _service.GetSelfAssessmentsAsync(User, playerId));

    // ─── Evidence-based scores ───────────────────────────────────────────────

    // All current calculated scores (with full source breakdown) for a player.
    [HttpGet("players/{playerId}/evidence-scores")]
    public async Task<ActionResult> GetEvidenceScores(int playerId)
        => Success(await _service.GetEvidenceScoresAsync(User, playerId));

    // Recalculate every metric for a player from the evidence currently on record.
    [HttpPost("evidence-scores/calculate/{playerId}")]
    public async Task<ActionResult> RecalculateAll(int playerId)
        => Success(await _service.RecalculateAllAsync(User, playerId));

    // Recalculate a single metric. 200 with null data when there is no evidence yet.
    [HttpPost("evidence-scores/calculate/{playerId}/{metricId}")]
    public async Task<ActionResult> RecalculateMetric(int playerId, int metricId)
        => Success(await _service.RecalculateMetricAsync(User, playerId, metricId));

    // Coach: every roster player's current evidence scores in one request (the
    // lineup view's batch load — full DTOs so per-player caches can be primed).
    [HttpGet("teams/{teamId}/evidence-scores")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetTeamEvidenceScores(int teamId)
        => Success(await _service.GetTeamEvidenceScoresAsync(User, teamId));

    // Coach: the whole roster's evidence coverage (who needs a test day / match stats).
    [HttpGet("teams/{teamId}/evidence-status")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetTeamEvidenceStatus(int teamId)
        => Success(await _service.GetTeamEvidenceStatusAsync(User, teamId));

    // Coach: per-metric squad performance rollup (average/spread/bands/outliers,
    // each with its coverage denominator) — powers the Squad performance card.
    [HttpGet("teams/{teamId}/evidence-performance")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetTeamEvidencePerformance(int teamId)
        => Success(await _service.GetTeamEvidencePerformanceAsync(User, teamId));

    // Coach dashboard: stale-test + low-confidence reminder items.
    [HttpGet("evidence-reminders")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetReminders()
        => Success(await _service.GetRemindersAsync(User));
}
