using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Athlete/solo daily progress journal. Entries are private by default; coaches only ever
// read a player's non-private entries (via /api/players/{id}/journal). Absolute "api"
// sub-routes so both /api/journal and /api/players/{id}/journal live here.
[Route("api")]
public class JournalController : ApiControllerBase
{
    private readonly IJournalService _service;

    public JournalController(IJournalService service)
    {
        _service = service;
    }

    // Athlete/solo: my entries, newest first (default last 90 days for the heat map).
    [HttpGet("journal")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetMine([FromQuery] int days = 90)
        => Success(await _service.GetMineAsync(User, days));

    // Athlete/solo: today's entry, or 200 with null body if not written yet.
    [HttpGet("journal/today")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetToday() => Success(await _service.GetTodayAsync(User));

    // Athlete/solo: create/update today's entry (upsert).
    [HttpPost("journal")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Upsert(UpsertJournalEntryDto dto) => Success(await _service.UpsertTodayAsync(User, dto));

    [HttpPut("journal/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Update(int id, UpsertJournalEntryDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("journal/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // Coach (non-private only) or the owning athlete: a player's journal entries.
    [HttpGet("players/{playerId}/journal")]
    public async Task<ActionResult> GetForPlayer(int playerId, [FromQuery] int days = 90)
        => Success(await _service.GetForPlayerAsync(User, playerId, days));
}
