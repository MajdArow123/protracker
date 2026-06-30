using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IWeeklyNutritionPlanService
{
    Task<WeeklyNutritionPlanDto?> GetLatestForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<WeeklyNutritionPlanDto> SavePlanAsync(ClaimsPrincipal user, int playerId, WeeklyNutritionPlanDto plan);
    Task<PlannedMealItemDto> SwapMealItemAsync(ClaimsPrincipal user, int mealItemId, SwapMealItemDto dto);
}

public class WeeklyNutritionPlanService : IWeeklyNutritionPlanService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public WeeklyNutritionPlanService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<WeeklyNutritionPlanDto?> GetLatestForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var plan = await _context.WeeklyNutritionPlans
            .Include(p => p.DailyMealPlans)
                .ThenInclude(d => d.PlannedMeals)
                    .ThenInclude(m => m.PlannedMealItems)
            .Where(p => p.PlayerId == playerId)
            .OrderByDescending(p => p.CreatedDate)
            .FirstOrDefaultAsync();

        return plan == null ? null : ToDto(plan);
    }

    public async Task<WeeklyNutritionPlanDto> SavePlanAsync(ClaimsPrincipal user, int playerId, WeeklyNutritionPlanDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var plan = new WeeklyNutritionPlan
        {
            PlayerId = playerId,
            IsAIGenerated = dto.IsAIGenerated,
            WeekStartDate = dto.WeekStartDate,
            DailyMealPlans = dto.DailyMealPlans.Select(d => new DailyMealPlan
            {
                DayNumber = d.DayNumber,
                DayName = d.DayName,
                DailyCalories = d.DailyCalories,
                DailyProtein = d.DailyProtein,
                DailyCarbs = d.DailyCarbs,
                DailyFats = d.DailyFats,
                PlannedMeals = d.PlannedMeals.Select(m => new PlannedMeal
                {
                    MealType = m.MealType,
                    Time = m.Time,
                    PlannedMealItems = m.PlannedMealItems.Select(i => new PlannedMealItem
                    {
                        FoodName = i.FoodName,
                        Portion = i.Portion,
                        Calories = i.Calories,
                        Protein = i.Protein,
                        Carbs = i.Carbs,
                        Fats = i.Fats,
                    }).ToList()
                }).ToList()
            }).ToList()
        };

        _context.WeeklyNutritionPlans.Add(plan);
        await _context.SaveChangesAsync();

        return ToDto(plan);
    }

    public async Task<PlannedMealItemDto> SwapMealItemAsync(ClaimsPrincipal user, int mealItemId, SwapMealItemDto dto)
    {
        var item = await _context.PlannedMealItems
            .Include(i => i.PlannedMeal)
                .ThenInclude(m => m.DailyMealPlan)
                    .ThenInclude(d => d.WeeklyNutritionPlan)
            .FirstOrDefaultAsync(i => i.Id == mealItemId)
            ?? throw new NotFoundApiException($"Meal item {mealItemId} was not found.");

        await _access.EnsureCanAccessPlayerAsync(user, item.PlannedMeal.DailyMealPlan.WeeklyNutritionPlan.PlayerId);

        item.OriginalFoodName = item.IsSwapped ? item.OriginalFoodName : item.FoodName;
        item.IsSwapped = true;
        item.FoodName = dto.NewFoodName;
        item.Portion = dto.NewPortion;
        item.Calories = dto.NewCalories;
        item.Protein = dto.NewProtein;
        item.Carbs = dto.NewCarbs;
        item.Fats = dto.NewFats;

        await _context.SaveChangesAsync();
        return ToItemDto(item);
    }

    public static WeeklyNutritionPlanDto ToDto(WeeklyNutritionPlan p) => new()
    {
        Id = p.Id,
        PlayerId = p.PlayerId,
        CreatedDate = p.CreatedDate,
        WeekStartDate = p.WeekStartDate,
        IsAIGenerated = p.IsAIGenerated,
        DailyMealPlans = p.DailyMealPlans
            .OrderBy(d => d.DayNumber)
            .Select(d => new DailyMealPlanDto
            {
                Id = d.Id,
                WeeklyNutritionPlanId = d.WeeklyNutritionPlanId,
                DayNumber = d.DayNumber,
                DayName = d.DayName,
                DailyCalories = d.DailyCalories,
                DailyProtein = d.DailyProtein,
                DailyCarbs = d.DailyCarbs,
                DailyFats = d.DailyFats,
                PlannedMeals = d.PlannedMeals
                    .OrderBy(m => m.MealType switch
                    {
                        "Breakfast" => 1, "Lunch" => 2, "Snack" => 3, "Dinner" => 4, _ => 5
                    })
                    .Select(m => new PlannedMealDto
                    {
                        Id = m.Id,
                        DailyMealPlanId = m.DailyMealPlanId,
                        MealType = m.MealType,
                        Time = m.Time,
                        PlannedMealItems = m.PlannedMealItems.Select(ToItemDto).ToList()
                    }).ToList()
            }).ToList()
    };

    private static PlannedMealItemDto ToItemDto(PlannedMealItem i) => new()
    {
        Id = i.Id,
        PlannedMealId = i.PlannedMealId,
        FoodName = i.FoodName,
        Portion = i.Portion,
        Calories = i.Calories,
        Protein = i.Protein,
        Carbs = i.Carbs,
        Fats = i.Fats,
        IsSwapped = i.IsSwapped,
        OriginalFoodName = i.OriginalFoodName,
    };
}
