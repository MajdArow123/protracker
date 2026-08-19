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

    // §5d Q1: bulk historical confirmation — owner-only in the service (uniform 404,
    // the S7 backfill contract; deliberately tighter than the single-stint path).
    [HttpGet("seasons/{seasonId}/roster/candidates")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetConfirmCandidates(int seasonId) =>
        Success(await _service.GetConfirmCandidatesAsync(User, seasonId));

    [HttpPost("seasons/{seasonId}/roster/confirm")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> ConfirmHistorical(int seasonId, ConfirmRosterRequestDto dto) =>
        Success(await _service.ConfirmHistoricalAsync(User, seasonId, dto));

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
