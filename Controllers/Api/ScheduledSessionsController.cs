using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class ScheduledSessionsController : ApiControllerBase
{
    private readonly IScheduledSessionService _service;

    public ScheduledSessionsController(IScheduledSessionService service)
    {
        _service = service;
    }

    [HttpGet("teams/{teamId}/sessions")]
    public async Task<ActionResult> GetForTeam(int teamId, [FromQuery] int? seasonId = null) => Success(await _service.GetForTeamAsync(User, teamId, seasonId));

    [HttpGet("sessions/mine")]
    public async Task<ActionResult> GetUpcomingForMe() => Success(await _service.GetUpcomingForMeAsync(User));

    [HttpPost("teams/{teamId}/sessions")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int teamId, CreateScheduledSessionDto dto) => Created(await _service.CreateAsync(User, teamId, dto));

    [HttpPut("sessions/{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Update(int id, CreateScheduledSessionDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("sessions/{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
