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

    [HttpGet("{originalFood}")]
    public async Task<ActionResult> GetByOriginalFood(string originalFood) => Success(await _service.GetByOriginalFoodAsync(originalFood));
}
