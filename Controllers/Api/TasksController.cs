using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/tasks")]
public class TasksController : ApiControllerBase
{
    private readonly IPlayerTaskService _service;

    public TasksController(IPlayerTaskService service)
    {
        _service = service;
    }

    // Coach: all tasks they created, optionally filtered.
    [HttpGet]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> GetForCoach(
        [FromQuery] int? playerId,
        [FromQuery] bool? completed,
        [FromQuery] TaskPriority? priority)
        => Success(await _service.GetForCoachAsync(User, playerId, completed, priority));

    // Athlete: tasks assigned to them.
    [HttpGet("mine")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetMine() => Success(await _service.GetMineAsync(User));

    // Coach: completion analytics across their assigned tasks.
    [HttpGet("analytics")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> GetAnalytics() => Success(await _service.GetAnalyticsAsync(User));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Create(CreatePlayerTaskDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Update(int id, CreatePlayerTaskDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpPatch("{id}/complete")]
    [Authorize(Roles = "Athlete,Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Complete(int id, CompleteTaskDto dto) => Success(await _service.CompleteAsync(User, id, dto));

    [HttpPatch("{id}/incomplete")]
    [Authorize(Roles = "Athlete,Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Incomplete(int id) => Success(await _service.IncompleteAsync(User, id));
}
