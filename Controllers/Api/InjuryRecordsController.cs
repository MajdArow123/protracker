using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/injury-records")]
public class InjuryRecordsController : ApiControllerBase
{
    private readonly IInjuryService _service;

    public InjuryRecordsController(IInjuryService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateInjuryRecordDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateInjuryRecordDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // Active injuries across all of the coach's teams (dashboard/roster indicators).
    [HttpGet("/api/injuries/active")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetActive() => Success(await _service.GetActiveForCoachAsync(User));

    // Mark an injury fully recovered (stamps RecoveredDate).
    [HttpPatch("/api/injuries/{id}/recover")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Recover(int id) => Success(await _service.RecoverAsync(User, id));
}
