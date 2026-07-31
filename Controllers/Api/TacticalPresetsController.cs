using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Coach-owned tactical presets (Phase 6). Owner-scoped: coaches only ever see
// and manage their own presets (Admin bypass on mutations). Applying a preset
// is client-side (diff + merge into the draft) — no apply endpoint by design.
[Route("api/tactical-presets")]
[Authorize(Roles = "Coach,Admin")]
public class TacticalPresetsController : ApiControllerBase
{
    private readonly ITacticalPresetService _presets;

    public TacticalPresetsController(ITacticalPresetService presets)
    {
        _presets = presets;
    }

    [HttpGet]
    public async Task<ActionResult> GetMine([FromQuery] int? sport)
        => Success(await _presets.GetMineAsync(User, sport));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SaveTacticalPresetDto dto)
        => Success(await _presets.CreateAsync(User, dto));

    [HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, [FromBody] SaveTacticalPresetDto dto)
        => Success(await _presets.UpdateAsync(User, id, dto));

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id)
    {
        await _presets.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
