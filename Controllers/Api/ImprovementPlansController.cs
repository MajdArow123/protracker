using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/improvement-plans")]
public class ImprovementPlansController : ApiControllerBase
{
    private readonly IImprovementPlanService _service;

    public ImprovementPlansController(IImprovementPlanService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateImprovementPlanDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateImprovementPlanDto dto) => Success(await _service.UpdateAsync(User, id, dto));
}
