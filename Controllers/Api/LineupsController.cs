using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Saved team lineups. Reads need team access; saves/deletes need CanManageTeam;
// publish/unpublish needs CanPublishLineup (all checked in the service — head
// coach + Admin always pass, assistants per their stored permissions). A
// published lineup is locked: upsert/delete 409 until an explicit unpublish.
[Route("api")]
public class LineupsController : ApiControllerBase
{
    private readonly ILineupService _lineups;

    public LineupsController(ILineupService lineups)
    {
        _lineups = lineups;
    }

    /// <summary>
    /// The saved lineup for the key, or null. Key: matchId → that match's
    /// lineup; name → a named team lineup; neither → the default XI.
    /// </summary>
    [HttpGet("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Get(int teamId, [FromQuery] int? matchId, [FromQuery] string? name)
        => Success(await _lineups.GetAsync(User, teamId, matchId, name));

    /// <summary>Every saved lineup for the team (default XI, named, per-match).</summary>
    [HttpGet("teams/{teamId:int}/lineups")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> List(int teamId)
        => Success(await _lineups.ListAsync(User, teamId));

    [HttpPut("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Upsert(int teamId, [FromBody] SaveLineupDto dto)
        => Success(await _lineups.UpsertAsync(User, teamId, dto));

    [HttpDelete("teams/{teamId:int}/lineup")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int teamId, [FromQuery] int? matchId, [FromQuery] string? name)
    {
        await _lineups.DeleteAsync(User, teamId, matchId, name);
        return NoContentSuccess();
    }

    [HttpPost("lineups/{lineupId:int}/publish")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Publish(int lineupId)
        => Success(await _lineups.PublishAsync(User, lineupId));

    [HttpPost("lineups/{lineupId:int}/unpublish")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Unpublish(int lineupId)
        => Success(await _lineups.UnpublishAsync(User, lineupId));

    /// <summary>Lightweight change audit for the team's lineups, newest first.</summary>
    [HttpGet("teams/{teamId:int}/lineup-audit")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Audit(int teamId, [FromQuery] int? lineupId, [FromQuery] int page = 1)
        => Success(await _lineups.GetAuditAsync(User, teamId, lineupId, page));
}
