using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Filters;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// AI injury-recovery endpoint. Route prefix, role gate, and the AI billing gate
// are identical across all AI controllers — routes must never change (frontend contract).
[Route("api/ai")]
[Authorize(Roles = "Coach,Admin,SoloAthlete")]
[AiBillingGate]
public class AIRecoveryController : ApiControllerBase
{
    private readonly IAIRecoveryService _service;

    public AIRecoveryController(IAIRecoveryService service)
    {
        _service = service;
    }

    [HttpPost("recovery-plan/{injuryId}")]
    public async Task<ActionResult> GenerateRecoveryPlan(int injuryId)
        => Success(await _service.GenerateRecoveryPlanAsync(User, injuryId));
}
