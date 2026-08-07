using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class MatchesController : ApiControllerBase
{
    private readonly IMatchService _service;

    public MatchesController(IMatchService service)
    {
        _service = service;
    }

    [HttpGet("teams/{teamId}/matches")]
    public async Task<ActionResult> GetForTeam(int teamId, [FromQuery] int? seasonId = null) => Success(await _service.GetForTeamAsync(User, teamId, seasonId));

    [HttpPost("teams/{teamId}/matches")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int teamId, CreateMatchResultDto dto) => Created(await _service.CreateAsync(User, teamId, dto));

    [HttpPut("matches/{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Update(int id, CreateMatchResultDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("matches/{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpPost("matches/{id}/ratings")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> SaveRatings(int id, SaveMatchRatingsDto dto) => Success(await _service.SaveRatingsAsync(User, id, dto));

    [HttpGet("players/{id}/match-ratings")]
    public async Task<ActionResult> GetPlayerRatings(int id, [FromQuery] int? seasonId = null) => Success(await _service.GetPlayerRatingsAsync(User, id, seasonId));
}
