using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class TeamsController : ApiControllerBase
{
    private readonly ITeamService _teamService;

    public TeamsController(ITeamService teamService)
    {
        _teamService = teamService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll() => Success(await _teamService.GetAccessibleTeamsAsync(User));

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id) => Success(await _teamService.GetByIdAsync(User, id));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(TeamCreateDto dto) => Created(await _teamService.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, TeamUpdateDto dto) => Success(await _teamService.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _teamService.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpGet("{id}/players")]
    public async Task<ActionResult> GetPlayers(int id) => Success(await _teamService.GetPlayersAsync(User, id));

    [HttpPost("{id}/photo")]
    [Authorize(Roles = "Coach,Admin")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult> UploadPhoto(int id, IFormFile file) =>
        Success(new { photoUrl = await _teamService.SetPhotoAsync(User, id, file) });

    [HttpDelete("{id}/photo")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> RemovePhoto(int id)
    {
        await _teamService.RemovePhotoAsync(User, id);
        return NoContentSuccess();
    }
}
