using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Benchmark calibration: age/level scoring profiles. System defaults are read-only;
// coaches manage their own custom profiles and pick which profile each team uses.
[Route("api")]
public class BenchmarkProfilesController : ApiControllerBase
{
    private readonly IBenchmarkService _service;

    public BenchmarkProfilesController(IBenchmarkService service)
    {
        _service = service;
    }

    [HttpGet("benchmark-profiles")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetProfiles([FromQuery] int sportId)
        => Success(await _service.GetProfilesAsync(User, sportId));

    [HttpPost("benchmark-profiles")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateBenchmarkProfileDto dto)
        => Created(await _service.CreateAsync(User, dto));

    [HttpPut("benchmark-profiles/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateBenchmarkProfileDto dto)
        => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("benchmark-profiles/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpGet("teams/{teamId}/benchmark-profile")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetTeamProfile(int teamId)
        => Success(await _service.GetTeamProfileAsync(User, teamId));

    [HttpPut("teams/{teamId}/benchmark-profile")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> SetTeamProfile(int teamId, SetTeamBenchmarkProfileDto dto)
        => Success(await _service.SetTeamProfileAsync(User, teamId, dto));

    // The benchmarks that apply to one player (any role with access — drives evidence
    // UI hints and the calibration badge).
    [HttpGet("players/{playerId}/benchmark-profile")]
    public async Task<ActionResult> GetPlayerBenchmarks(int playerId)
        => Success(await _service.GetPlayerBenchmarksAsync(User, playerId));
}
