using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// League & tournament mode. Absolute "api" sub-routes so /api/leagues and
// /api/league-matches both live here.
[Route("api")]
public class LeaguesController : ApiControllerBase
{
    private readonly ILeagueService _service;

    public LeaguesController(ILeagueService service)
    {
        _service = service;
    }

    // Public league listing (filters). Any authenticated role can browse.
    [HttpGet("leagues")]
    public async Task<ActionResult> List(
        [FromQuery] int? sport, [FromQuery] LeagueStatus? status, [FromQuery] LeagueType? type, [FromQuery] string? search)
        => Success(await _service.ListAsync(User, sport, status, type, search));

    // Leagues I organize or my team is registered in.
    [HttpGet("leagues/mine")]
    public async Task<ActionResult> Mine() => Success(await _service.ListMineAsync(User));

    [HttpGet("leagues/{id}")]
    public async Task<ActionResult> Get(int id) => Success(await _service.GetDetailAsync(User, id));

    [HttpPost("leagues")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateLeagueDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("leagues/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, UpdateLeagueDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("leagues/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // --- Team registration ---

    [HttpPost("leagues/{id}/teams")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> RegisterTeam(int id, RegisterLeagueTeamDto dto)
        => Created(await _service.RegisterTeamAsync(User, id, dto.TeamId));

    [HttpPut("leagues/{id}/teams/{leagueTeamId}/approve")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Approve(int id, int leagueTeamId)
        => Success(await _service.SetTeamStatusAsync(User, id, leagueTeamId, LeagueTeamStatus.Approved));

    [HttpPut("leagues/{id}/teams/{leagueTeamId}/reject")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Reject(int id, int leagueTeamId)
        => Success(await _service.SetTeamStatusAsync(User, id, leagueTeamId, LeagueTeamStatus.Rejected));

    // --- Matches ---

    [HttpGet("leagues/{id}/matches")]
    public async Task<ActionResult> GetMatches(int id) => Success(await _service.GetMatchesAsync(User, id));

    [HttpPost("leagues/{id}/matches")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> CreateMatch(int id, CreateLeagueMatchDto dto)
        => Created(await _service.CreateMatchAsync(User, id, dto));

    [HttpPut("league-matches/{id}/score")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> UpdateScore(int id, UpdateLeagueMatchScoreDto dto)
        => Success(await _service.UpdateMatchScoreAsync(User, id, dto));

    [HttpDelete("league-matches/{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> DeleteMatch(int id)
    {
        await _service.DeleteMatchAsync(User, id);
        return NoContentSuccess();
    }

    [HttpPost("leagues/{id}/generate-schedule")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GenerateSchedule(int id)
        => Success(new { matchesCreated = await _service.GenerateScheduleAsync(User, id) });

    // --- Standings ---

    [HttpGet("leagues/{id}/standings")]
    public async Task<ActionResult> GetStandings(int id) => Success(await _service.GetStandingsAsync(User, id));
}
