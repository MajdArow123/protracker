using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Coaching-staff management: head coaches invite/manage assistant coaches & analysts on their
// teams. Uses absolute sub-routes ([Route("api")]) like the other cross-cutting controllers.
[Route("api")]
[Authorize(Roles = "Coach,Admin")]
public class TeamCoachesController : ApiControllerBase
{
    private readonly ITeamCoachService _service;

    public TeamCoachesController(ITeamCoachService service)
    {
        _service = service;
    }

    // Everyone with team access can see the coaching staff.
    [HttpGet("teams/{id}/coaches")]
    public async Task<ActionResult> List(int id) => Success(await _service.ListCoachesAsync(User, id));

    // The caller's own permissions on a team (used by the frontend to gate UI).
    [HttpGet("teams/{id}/my-coach-permissions")]
    public async Task<ActionResult> MyPermissions(int id) => Success(await _service.GetMyPermissionsAsync(User, id));

    // Head-coach only (enforced in the service).
    [HttpPost("teams/{id}/invite-coach")]
    public async Task<ActionResult> Invite(int id, InviteCoachDto dto) => Created(await _service.InviteCoachAsync(User, id, dto));

    [HttpPut("team-coaches/{id}/permissions")]
    public async Task<ActionResult> UpdatePermissions(int id, CoachPermissionsDto perms) =>
        Success(await _service.UpdatePermissionsAsync(User, id, perms));

    [HttpDelete("team-coaches/{id}")]
    public async Task<ActionResult> Remove(int id)
    {
        await _service.RemoveAsync(User, id);
        return NoContentSuccess();
    }

    // --- Public invite acceptance ---

    [HttpGet("assistant-invites/validate/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> Validate(string token) => Success(await _service.ValidateInviteAsync(token));
}
