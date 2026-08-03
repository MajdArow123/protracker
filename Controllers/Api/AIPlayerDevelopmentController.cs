using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Filters;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// AI player-development endpoints. Route prefix, role gate, and the AI billing gate
// are identical across all AI controllers — routes must never change (frontend contract).
[Route("api/ai")]
[Authorize(Roles = "Coach,Admin,SoloAthlete")]
[AiBillingGate]
public class AIPlayerDevelopmentController : ApiControllerBase
{
    private readonly IAIPlayerDevelopmentService _service;

    public AIPlayerDevelopmentController(IAIPlayerDevelopmentService service)
    {
        _service = service;
    }

    [HttpPost("improvement-plan/{playerId}")]
    public async Task<ActionResult> GenerateImprovementPlan(int playerId)
        => Success(await _service.GenerateImprovementPlanAsync(User, playerId));

    [HttpPost("task-suggestions/{playerId}")]
    public async Task<ActionResult> GenerateTaskSuggestions(int playerId)
        => Success(await _service.GenerateTaskSuggestionsAsync(User, playerId));

    [HttpPost("goal-suggestions/{playerId}")]
    public async Task<ActionResult> GenerateGoalSuggestions(int playerId)
        => Success(await _service.GenerateGoalSuggestionsAsync(User, playerId));

    [HttpPost("drill-recommendations/{playerId}")]
    public async Task<ActionResult> GenerateDrillRecommendations(int playerId)
        => Success(await _service.GenerateDrillRecommendationsAsync(User, playerId));
}
