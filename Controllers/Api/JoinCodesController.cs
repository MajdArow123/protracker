using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class JoinCodesController : ApiControllerBase
{
    private readonly IJoinCodeService _service;

    public JoinCodesController(IJoinCodeService service)
    {
        _service = service;
    }

    // --- Coach: manage a team's join codes ---

    [HttpPost("teams/{id}/join-code")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Generate(int id, GenerateJoinCodeRequest request) =>
        Created(await _service.GenerateAsync(User, id, request));

    [HttpGet("teams/{id}/join-codes")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetForTeam(int id) => Success(await _service.GetForTeamAsync(User, id));

    [HttpDelete("join-codes/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Deactivate(int id)
    {
        await _service.DeactivateAsync(User, id);
        return NoContentSuccess();
    }

    // --- Public: validate a code before the athlete commits to registering ---
    // Rate-limited per IP so codes can't be brute-forced.

    [HttpGet("join-codes/validate/{code}")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> Validate(string code) => Success(await _service.ValidateAsync(code));

    // --- Coach: invite a specific athlete by email (sends the join link) ---

    [HttpPost("teams/{id}/invite-athlete")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> InviteAthlete(int id, InviteAthleteRequest request) =>
        Created(await _service.InviteAthleteAsync(User, id, request.Email));

    [HttpGet("teams/{id}/athlete-invites")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetInvites(int id) => Success(await _service.GetInvitesAsync(User, id));
}
