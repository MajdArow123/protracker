using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Saved team lineups (Phase 2 of the lineup view). Reads need team access; writes
// need the CanManageTeam permission (checked in the service — head coach + Admin
// always pass, assistants per their stored permissions).
[Route("api")]
public class LineupsController : ApiControllerBase
{
    private readonly ILineupService _lineups;

    public LineupsController(ILineupService lineups)
    {
        _lineups = lineups;
    }

    /// <summary>The saved lineup for the key (default XI when matchId is absent), or null.</summary>
    [HttpGet("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Get(int teamId, [FromQuery] int? matchId)
        => Success(await _lineups.GetAsync(User, teamId, matchId));

    [HttpPut("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Upsert(int teamId, [FromBody] SaveLineupDto dto)
        => Success(await _lineups.UpsertAsync(User, teamId, dto));

    [HttpDelete("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int teamId, [FromQuery] int? matchId)
    {
        await _lineups.DeleteAsync(User, teamId, matchId);
        return NoContentSuccess();
    }
}
