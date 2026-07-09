using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Coach ⇄ athlete connection requests from the marketplace. Absolute "api" sub-routes.
[Route("api")]
public class ConnectionRequestsController : ApiControllerBase
{
    private readonly ICoachConnectionService _service;

    public ConnectionRequestsController(ICoachConnectionService service)
    {
        _service = service;
    }

    // Athlete / solo athlete sends a request to a coach found on the marketplace.
    [HttpPost("coaches/{slug}/request")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> Send(string slug, SendConnectionRequestDto dto)
        => Created(await _service.SendAsync(User, slug, dto));

    // Coach views incoming requests, optionally filtered by status.
    [HttpGet("coach/connection-requests")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetForCoach([FromQuery] ConnectionRequestStatus? status)
        => Success(await _service.GetForCoachAsync(User, status));

    [HttpPatch("coach/connection-requests/{id}/accept")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Accept(int id) => Success(await _service.AcceptAsync(User, id));

    [HttpPatch("coach/connection-requests/{id}/decline")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Decline(int id, DeclineConnectionRequestDto dto)
        => Success(await _service.DeclineAsync(User, id, dto.Reason));

    // Athlete views their sent requests + status.
    [HttpGet("athlete/connection-requests")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetForAthlete() => Success(await _service.GetForAthleteAsync(User));

    [HttpDelete("athlete/connection-requests/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Withdraw(int id)
    {
        await _service.WithdrawAsync(User, id);
        return NoContentSuccess();
    }
}
