using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Filters;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// AI nutrition endpoints. Route prefix, role gate, and the AI billing gate
// are identical across all AI controllers — routes must never change (frontend contract).
[Route("api/ai")]
[Authorize(Roles = "Coach,Admin,SoloAthlete")]
[AiBillingGate]
public class AINutritionController : ApiControllerBase
{
    private readonly IAINutritionService _service;

    public AINutritionController(IAINutritionService service)
    {
        _service = service;
    }

    [HttpPost("nutrition-guidance/{playerId}")]
    public async Task<ActionResult> GenerateNutritionGuidance(int playerId)
        => Success(await _service.GenerateGuidanceAsync(User, playerId));

    [HttpPost("weekly-nutrition-plan/{playerId}")]
    public async Task<ActionResult> GenerateWeeklyNutritionPlan(int playerId)
        => Success(await _service.GenerateWeeklyPlanAsync(User, playerId));
}
