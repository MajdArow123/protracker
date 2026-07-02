using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Coach-private player notes. The entire controller is restricted to coaches/admins —
// these notes must NEVER be exposed to athletes.
[Route("api")]
[Authorize(Roles = "Coach,Admin")]
public class CoachNotesController : ApiControllerBase
{
    private readonly ICoachNoteService _service;

    public CoachNotesController(ICoachNoteService service)
    {
        _service = service;
    }

    [HttpGet("players/{playerId}/notes")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost("players/{playerId}/notes")]
    public async Task<ActionResult> Create(int playerId, CreateCoachNoteDto dto) => Created(await _service.CreateAsync(User, playerId, dto));

    [HttpPut("notes/{id}")]
    public async Task<ActionResult> Update(int id, CreateCoachNoteDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("notes/{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
