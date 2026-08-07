using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/training-sessions")]
public class TrainingSessionsController : ApiControllerBase
{
    private readonly ITrainingSessionService _service;

    public TrainingSessionsController(ITrainingSessionService service)
    {
        _service = service;
    }

    [HttpGet("team/{teamId}")]
    public async Task<ActionResult> GetForTeam(int teamId, [FromQuery] int? seasonId = null) => Success(await _service.GetForTeamAsync(User, teamId, seasonId));

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId, [FromQuery] int? seasonId = null) => Success(await _service.GetForPlayerAsync(User, playerId, seasonId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateTrainingSessionDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateTrainingSessionDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
