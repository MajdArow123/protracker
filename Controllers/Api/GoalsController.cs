using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Personal goals for athletes and solo athletes (coaches may create/manage non-private goals
// for their players). Uses absolute "api" sub-routes so it can expose both /api/goals and
// /api/players/{id}/goals.
[Route("api")]
public class GoalsController : ApiControllerBase
{
    private readonly IPersonalGoalService _service;

    public GoalsController(IPersonalGoalService service)
    {
        _service = service;
    }

    // Athlete/solo: all of my own goals (including private).
    [HttpGet("goals")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetMine() => Success(await _service.GetMineAsync(User));

    // Coach (non-private only) or the owning athlete (all): a player's goals.
    [HttpGet("players/{playerId}/goals")]
    public async Task<ActionResult> GetForPlayer(int playerId)
        => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost("goals")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> Create(CreateGoalDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("goals/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> Update(int id, UpdateGoalDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("goals/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpPatch("goals/{id}/achieve")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> Achieve(int id) => Success(await _service.AchieveAsync(User, id));

    [HttpPost("goals/{id}/milestones")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> AddMilestone(int id, CreateGoalMilestoneDto dto)
        => Created(await _service.AddMilestoneAsync(User, id, dto));

    [HttpPatch("goals/{id}/milestones/{mid}/achieve")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> AchieveMilestone(int id, int mid)
        => Success(await _service.AchieveMilestoneAsync(User, id, mid));

    [HttpPost("goals/{id}/progress")]
    [Authorize(Roles = "Athlete,SoloAthlete,Coach,Admin")]
    public async Task<ActionResult> LogProgress(int id, LogGoalProgressDto dto)
        => Created(await _service.LogProgressAsync(User, id, dto));

    [HttpGet("goals/{id}/progress")]
    public async Task<ActionResult> GetProgress(int id) => Success(await _service.GetProgressAsync(User, id));
}
