using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// The drill & exercise library. Everyone (coach/athlete/solo) can browse; coaches and solo
// athletes can create custom drills, favorite, and assign drills as tasks. Team athletes get
// read-only browse + favorites (they cannot create or assign).
[Route("api/drills")]
public class DrillsController : ApiControllerBase
{
    private readonly IDrillService _service;

    public DrillsController(IDrillService service)
    {
        _service = service;
    }

    // Browse the library (paginated 20/page) with optional filters.
    [HttpGet]
    public async Task<ActionResult> List(
        [FromQuery] int? sport,
        [FromQuery] DrillCategory? category,
        [FromQuery] DrillDifficulty? difficulty,
        [FromQuery] string? search,
        [FromQuery] bool favorited = false,
        [FromQuery] bool mine = false,
        [FromQuery] bool recommended = false,
        [FromQuery] int? playerId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
        => Success(await _service.ListAsync(User, new DrillFilters
        {
            SportId = sport, Category = category, Difficulty = difficulty, Search = search,
            Favorited = favorited, Mine = mine, Recommended = recommended, PlayerId = playerId,
            Page = page, PageSize = pageSize,
        }));

    [HttpGet("favorites")]
    public async Task<ActionResult> Favorites() => Success(await _service.GetFavoritesAsync(User));

    [HttpGet("{id}")]
    public async Task<ActionResult> Get(int id) => Success(await _service.GetByIdAsync(User, id));

    [HttpPost]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Create(CreateDrillDto dto) => Created(await _service.CreateAsync(User, dto));

    [HttpPut("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Update(int id, CreateDrillDto dto) => Success(await _service.UpdateAsync(User, id, dto));

    [HttpDelete("{id}")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    // Toggle favorite; returns { isFavorited }.
    [HttpPost("{id}/favorite")]
    public async Task<ActionResult> ToggleFavorite(int id)
        => Success(new { isFavorited = await _service.ToggleFavoriteAsync(User, id) });

    // Assign a drill to a player as a task (coach for their players, solo for themselves).
    [HttpPost("{id}/assign")]
    [Authorize(Roles = "Coach,Admin,SoloAthlete")]
    public async Task<ActionResult> Assign(int id, AssignDrillDto dto) => Created(await _service.AssignAsync(User, id, dto));
}
