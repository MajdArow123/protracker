using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Athlete feedback on scheduled sessions. Absolute sub-routes ([Route("api")]) like the
// other cross-cutting controllers.
[Route("api")]
public class SessionFeedbackController : ApiControllerBase
{
    private readonly ISessionFeedbackService _service;

    public SessionFeedbackController(ISessionFeedbackService service)
    {
        _service = service;
    }

    // Athlete / solo athlete submits (upsert).
    [HttpPost("sessions/{id}/feedback")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Submit(int id, SubmitSessionFeedbackDto dto) =>
        Success(await _service.SubmitAsync(User, id, dto));

    // Coach (team access) / solo athlete (own session) views all feedback + summary.
    [HttpGet("sessions/{id}/feedback")]
    public async Task<ActionResult> GetForSession(int id) => Success(await _service.GetForSessionAsync(User, id));

    // Coach views a player's feedback history.
    [HttpGet("players/{id}/session-feedback")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> GetForPlayer(int id) => Success(await _service.GetForPlayerAsync(User, id));

    // Athlete / solo: their own past sessions with feedback (pending vs submitted).
    [HttpGet("sessions/feedback/mine")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetMine() => Success(await _service.GetMineAsync(User));

    // Coach analytics for the team Schedule tab.
    [HttpGet("teams/{id}/session-feedback-analytics")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Analytics(int id) => Success(await _service.GetTeamAnalyticsAsync(User, id));
}
