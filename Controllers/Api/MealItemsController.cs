using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/meal-items")]
public class MealItemsController : ApiControllerBase
{
    private readonly IWeeklyNutritionPlanService _weeklyNutritionPlanService;

    public MealItemsController(IWeeklyNutritionPlanService weeklyNutritionPlanService)
    {
        _weeklyNutritionPlanService = weeklyNutritionPlanService;
    }

    [HttpPost("{id}/swap")]
    public async Task<ActionResult> Swap(int id, SwapMealItemDto dto) =>
        Success(await _weeklyNutritionPlanService.SwapMealItemAsync(User, id, dto));
}
