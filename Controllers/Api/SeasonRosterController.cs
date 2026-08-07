using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Phase 10 S6: roster-stint CRUD — the only write path to SeasonRoster. Reads follow
// season read access (participating-team members included); writes are coach-role
// gated here and CanManagePlayers-gated on the stint's team in the service.
[Route("api")]
public class SeasonRosterController : ApiControllerBase
{
    private readonly ISeasonRosterService _service;

    public SeasonRosterController(ISeasonRosterService service)
    {
        _service = service;
    }

    [HttpGet("seasons/{seasonId}/roster")]
    public async Task<ActionResult> GetForSeason(int seasonId) =>
        Success(await _service.GetForSeasonAsync(User, seasonId));

    [HttpPost("seasons/{seasonId}/roster")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int seasonId, SaveSeasonRosterStintDto dto) =>
        Created(await _service.CreateAsync(User, seasonId, dto));

    [HttpPut("season-roster/{stintId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int stintId, SaveSeasonRosterStintDto dto) =>
        Success(await _service.UpdateAsync(User, stintId, dto));

    [HttpDelete("season-roster/{stintId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int stintId)
    {
        await _service.DeleteAsync(User, stintId);
        return NoContentSuccess();
    }
}
