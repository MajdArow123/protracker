using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Private athlete notes. The ENTIRE controller is Athlete/SoloAthlete-only, so a coach
// (or any other role) gets 403 on every action — coaches can never read athlete notes.
[Route("api/athlete-notes")]
[Authorize(Roles = "Athlete,SoloAthlete")]
public class AthleteNotesController : ApiControllerBase
{
    private readonly IAthleteNoteService _service;

    public AthleteNotesController(IAthleteNoteService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult> GetMine() => Success(await _service.GetMineAsync(User));

    [HttpPost]
    public async Task<ActionResult> Create(UpsertAthleteNoteDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, UpsertAthleteNoteDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
