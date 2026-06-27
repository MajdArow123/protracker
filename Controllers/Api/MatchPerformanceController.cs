using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/match-performance")]
public class MatchPerformanceController : ApiControllerBase
{
    private readonly IMatchPerformanceService _service;

    public MatchPerformanceController(IMatchPerformanceService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateMatchPerformanceDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateMatchPerformanceDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
