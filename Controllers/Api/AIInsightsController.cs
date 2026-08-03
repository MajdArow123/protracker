using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Filters;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// AI analysis endpoints. Route prefix, role gate, and the AI billing gate
// are identical across all AI controllers — routes must never change (frontend contract).
[Route("api/ai")]
[Authorize(Roles = "Coach,Admin,SoloAthlete")]
[AiBillingGate]
public class AIInsightsController : ApiControllerBase
{
    private readonly IAIInsightsService _service;

    public AIInsightsController(IAIInsightsService service)
    {
        _service = service;
    }

    [HttpPost("performance-insights/{playerId}")]
    public async Task<ActionResult> GeneratePerformanceInsights(int playerId)
        => Success(await _service.GeneratePerformanceInsightsAsync(User, playerId));

    [HttpPost("evidence-analysis/{playerId}")]
    public async Task<ActionResult> GenerateEvidenceAnalysis(int playerId)
        => Success(await _service.GenerateEvidenceAnalysisAsync(User, playerId));

    [HttpPost("team-insights/{teamId}")]
    public async Task<ActionResult> GenerateTeamInsights(int teamId)
        => Success(await _service.GenerateTeamInsightsAsync(User, teamId));
}
