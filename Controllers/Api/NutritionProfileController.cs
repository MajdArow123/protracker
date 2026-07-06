using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/nutrition-profile")]
public class NutritionProfileController : ApiControllerBase
{
    private readonly INutritionProfileService _service;

    public NutritionProfileController(INutritionProfileService service)
    {
        _service = service;
    }

    [HttpGet("player/{playerId}")]
    public async Task<ActionResult> GetForPlayer(int playerId) => Success(await _service.GetForPlayerAsync(User, playerId));

    // Athletes may manage their own restrictions (profile page / onboarding);
    // EnsureCanAccessPlayerAsync inside the service scopes athletes to their own player.
    [HttpPost("player/{playerId}")]
    [Authorize(Roles = "Coach,Admin,Athlete,SoloAthlete")]
    public async Task<ActionResult> Create(int playerId, CreateNutritionProfileItemDto dto) => Created(await _service.CreateAsync(User, playerId, dto));

    [HttpPut("player/{playerId}/{profileItemId}")]
    [Authorize(Roles = "Coach,Admin,Athlete,SoloAthlete")]
    public async Task<ActionResult> Update(int playerId, int profileItemId, CreateNutritionProfileItemDto dto) =>
        Success(await _service.UpdateAsync(User, playerId, profileItemId, dto));

    [HttpDelete("player/{playerId}/{profileItemId}")]
    [Authorize(Roles = "Coach,Admin,Athlete,SoloAthlete")]
    public async Task<ActionResult> Delete(int playerId, int profileItemId)
    {
        await _service.DeleteAsync(User, playerId, profileItemId);
        return NoContentSuccess();
    }
}
