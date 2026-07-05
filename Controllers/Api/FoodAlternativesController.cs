using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/food-alternatives")]
public class FoodAlternativesController : ApiControllerBase
{
    private readonly IFoodAlternativesService _service;

    public FoodAlternativesController(IFoodAlternativesService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll() => Success(await _service.GetAllAsync());

    // Portion-scaled equivalents for the meal item being swapped. Pass the item's macros;
    // each returned food is resized so its calories match, with a good/similar/different rating.
    [HttpGet("equivalent")]
    public async Task<ActionResult> GetEquivalent(
        [FromQuery] int calories, [FromQuery] int protein,
        [FromQuery] int carbs, [FromQuery] int fats, [FromQuery] string? exclude = null) =>
        Success(await _service.GetEquivalentsAsync(calories, protein, carbs, fats, exclude));

    [HttpGet("{originalFood}")]
    public async Task<ActionResult> GetByOriginalFood(string originalFood) => Success(await _service.GetByOriginalFoodAsync(originalFood));
}
