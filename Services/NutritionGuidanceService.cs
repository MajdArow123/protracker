using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface INutritionGuidanceService
{
    Task<List<NutritionGuidanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<NutritionGuidanceDto> CreateAsync(ClaimsPrincipal user, CreateNutritionGuidanceDto dto);
    Task<NutritionGuidanceDto> UpdateAsync(ClaimsPrincipal user, int id, CreateNutritionGuidanceDto dto);
}

// Hard-severity allergy/dietary restrictions are sensitive data. This service never strips
// them from the response for an authorized caller, but EnsureCanAccessPlayerAsync gates who
// is an authorized caller in the first place.
public class NutritionGuidanceService : INutritionGuidanceService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public NutritionGuidanceService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<NutritionGuidanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var guidance = await _context.NutritionGuidances.Where(g => g.PlayerId == playerId)
            .OrderByDescending(g => g.CreatedDate).ToListAsync();
        return guidance.Select(ToDto).ToList();
    }

    public async Task<NutritionGuidanceDto> CreateAsync(ClaimsPrincipal user, CreateNutritionGuidanceDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        var guidance = new NutritionGuidance
        {
            PlayerId = dto.PlayerId,
            Goal = dto.Goal,
            MealSuggestions = dto.MealSuggestions,
            HydrationTips = dto.HydrationTips,
            RecoveryTips = dto.RecoveryTips,
            FoodsToPrioritize = dto.FoodsToPrioritize,
            FoodsToLimit = dto.FoodsToLimit
        };
        _context.NutritionGuidances.Add(guidance);
        await _context.SaveChangesAsync();
        return ToDto(guidance);
    }

    public async Task<NutritionGuidanceDto> UpdateAsync(ClaimsPrincipal user, int id, CreateNutritionGuidanceDto dto)
    {
        var guidance = await _context.NutritionGuidances.FirstOrDefaultAsync(g => g.Id == id)
            ?? throw new NotFoundApiException($"Nutrition guidance {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, guidance.PlayerId);

        guidance.Goal = dto.Goal;
        guidance.MealSuggestions = dto.MealSuggestions;
        guidance.HydrationTips = dto.HydrationTips;
        guidance.RecoveryTips = dto.RecoveryTips;
        guidance.FoodsToPrioritize = dto.FoodsToPrioritize;
        guidance.FoodsToLimit = dto.FoodsToLimit;
        await _context.SaveChangesAsync();
        return ToDto(guidance);
    }

    private static NutritionGuidanceDto ToDto(NutritionGuidance g) => new()
    {
        Id = g.Id,
        PlayerId = g.PlayerId,
        CreatedDate = g.CreatedDate,
        Goal = g.Goal,
        MealSuggestions = g.MealSuggestions,
        HydrationTips = g.HydrationTips,
        RecoveryTips = g.RecoveryTips,
        FoodsToPrioritize = g.FoodsToPrioritize,
        FoodsToLimit = g.FoodsToLimit,
        Disclaimer = g.Disclaimer,
        IsAIGenerated = g.IsAIGenerated
    };
}
