using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class SeasonsController : ApiControllerBase
{
    private readonly ISeasonService _service;

    public SeasonsController(ISeasonService service)
    {
        _service = service;
    }

    [HttpGet("teams/{teamId}/seasons")]
    public async Task<ActionResult> GetForTeam(int teamId) => Success(await _service.GetForTeamAsync(User, teamId));

    // date = the client's LOCAL calendar date (yyyy-MM-dd), UTC today when absent —
    // see the ruling in SeasonService.GetCurrentForTeamAsync.
    [HttpGet("teams/{teamId}/seasons/current")]
    public async Task<ActionResult> GetCurrent(int teamId, [FromQuery] string? date = null) =>
        Success(await _service.GetCurrentForTeamAsync(User, teamId, date));

    // The account's Active seasons (owner-scoped) — powers the dashboard "current season" strip.
    [HttpGet("seasons/active")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetActiveForOwner() => Success(await _service.GetActiveForOwnerAsync(User));

    [HttpPost("teams/{teamId}/seasons")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(int teamId, CreateSeasonDto dto) => Created(await _service.CreateAsync(User, teamId, dto));

    [HttpPut("seasons/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateSeasonDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("seasons/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // Sets the account's write-resolution default season (ApplicationUser.CurrentSeasonId).
    // Explicit by design — this is not the UI season switcher, and Status=Active on other
    // seasons is untouched (overlap is allowed).
    [HttpPost("seasons/{id}/set-current")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> SetCurrent(int id)
    {
        await _service.SetCurrentAsync(User, id);
        return NoContentSuccess();
    }

    [HttpGet("seasons/{id}/summary")]
    public async Task<ActionResult> GetSummary(int id) => Success(await _service.GetSummaryAsync(User, id));

    [HttpPost("seasons/{id}/periods/{periodId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> LinkPeriod(int id, int periodId)
    {
        await _service.LinkPeriodAsync(User, id, periodId, link: true);
        return NoContentSuccess();
    }

    [HttpDelete("seasons/{id}/periods/{periodId}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> UnlinkPeriod(int id, int periodId)
    {
        await _service.LinkPeriodAsync(User, id, periodId, link: false);
        return NoContentSuccess();
    }
}
