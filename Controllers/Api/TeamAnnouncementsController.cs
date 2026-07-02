using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class TeamAnnouncementsController : ApiControllerBase
{
    private readonly ITeamAnnouncementService _service;

    public TeamAnnouncementsController(ITeamAnnouncementService service)
    {
        _service = service;
    }

    [HttpGet("teams/{teamId}/announcements")]
    public async Task<ActionResult> GetForTeam(int teamId) => Success(await _service.GetForTeamAsync(User, teamId));

    [HttpGet("announcements/mine")]
    public async Task<ActionResult> GetForMe() => Success(await _service.GetForMeAsync(User));

    [HttpPost("teams/{teamId}/announcements")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int teamId, CreateTeamAnnouncementDto dto) => Created(await _service.CreateAsync(User, teamId, dto));

    [HttpPut("announcements/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateTeamAnnouncementDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("announcements/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
