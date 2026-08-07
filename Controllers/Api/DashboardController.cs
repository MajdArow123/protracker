using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class DashboardController : ApiControllerBase
{
    private readonly IDashboardService _service;

    public DashboardController(IDashboardService service)
    {
        _service = service;
    }

    [HttpGet("coach")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Coach() => Success(await _service.GetCoachDashboardAsync(User));

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> Player(int playerId, [FromQuery] int? seasonId = null) => Success(await _service.GetPlayerDashboardAsync(User, playerId, seasonId));
}
