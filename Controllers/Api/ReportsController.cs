using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class ReportsController : ApiControllerBase
{
    private readonly IReportService _service;

    public ReportsController(IReportService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> PlayerReport(int playerId) => Success(await _service.GetPlayerReportAsync(User, playerId));

    [HttpGet("team/{teamId}")]
    public async Task<ActionResult> TeamReport(int teamId) => Success(await _service.GetTeamReportAsync(User, teamId));
}
