using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IFoodAlternativesService
{
    Task<List<FoodAlternativeDto>> GetAllAsync();
    Task<List<FoodAlternativeDto>> GetByOriginalFoodAsync(string originalFood);
}

public class FoodAlternativesService : IFoodAlternativesService
{
    private readonly ApplicationDbContext _context;

    public FoodAlternativesService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<FoodAlternativeDto>> GetAllAsync() =>
        await _context.FoodAlternativesLibrary.Select(ToDtoExpr()).ToListAsync();

    public async Task<List<FoodAlternativeDto>> GetByOriginalFoodAsync(string originalFood) =>
        await _context.FoodAlternativesLibrary
            .Where(f => f.OriginalFood.ToLower() == originalFood.ToLower())
            .Select(ToDtoExpr())
            .ToListAsync();

    private static System.Linq.Expressions.Expression<Func<ProTracker.Models.FoodAlternativesLibrary, FoodAlternativeDto>> ToDtoExpr() =>
        f => new FoodAlternativeDto
        {
            Id = f.Id,
            OriginalFood = f.OriginalFood,
            AlternativeFood = f.AlternativeFood,
            ProteinMatchScore = f.ProteinMatchScore,
            CarbMatchScore = f.CarbMatchScore,
            FatMatchScore = f.FatMatchScore,
            CalorieMatchScore = f.CalorieMatchScore,
            RecoveryValue = f.RecoveryValue,
            SportPerformanceNote = f.SportPerformanceNote,
            ReasonExplanation = f.ReasonExplanation
        };
}
