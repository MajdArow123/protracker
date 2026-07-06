using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Athlete wellbeing check-ins. Athletes submit/read their own daily entries; coaches read a
// per-player 30-day trend and a team-wide summary (with pain-during-recovery alerts).
[Route("api")]
public class WellbeingController : ApiControllerBase
{
    private readonly IWellbeingService _service;

    public WellbeingController(IWellbeingService service)
    {
        _service = service;
    }

    // Athlete: my recent check-ins (default last 30 days).
    [HttpGet("wellbeing/mine")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetMine([FromQuery] int days = 30)
        => Success(await _service.GetMineAsync(User, days));

    // Athlete: today's check-in, or 200 with null body if not submitted yet.
    [HttpGet("wellbeing/today")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetToday() => Success(await _service.GetTodayAsync(User));

    // Athlete: submit (upsert) today's check-in.
    [HttpPost("wellbeing")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Submit(CreateWellbeingCheckinDto dto)
        => Success(await _service.SubmitAsync(User, dto));

    // Coach/athlete-own: a player's daily check-in trend over a window (default 30 days).
    [HttpGet("players/{playerId}/wellbeing")]
    public async Task<ActionResult> GetPlayerTrend(int playerId, [FromQuery] int days = 30)
        => Success(await _service.GetPlayerTrendAsync(User, playerId, days));

    // Coach: team wellbeing summary for the dashboard card.
    [HttpGet("wellbeing/team-summary")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetTeamSummary() => Success(await _service.GetTeamSummaryAsync(User));
}
