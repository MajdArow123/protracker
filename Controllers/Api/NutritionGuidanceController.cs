using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/nutrition-guidance")]
public class NutritionGuidanceController : ApiControllerBase
{
    private readonly INutritionGuidanceService _service;

    public NutritionGuidanceController(INutritionGuidanceService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Create(CreateNutritionGuidanceDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Update(int id, CreateNutritionGuidanceDto dto) => Success(await _service.UpdateAsync(User, id, dto));
}
