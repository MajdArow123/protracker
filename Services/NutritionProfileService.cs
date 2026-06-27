using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface INutritionProfileService
{
    Task<List<NutritionProfileItemDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<NutritionProfileItemDto> CreateAsync(ClaimsPrincipal user, int playerId, CreateNutritionProfileItemDto dto);
    Task<NutritionProfileItemDto> UpdateAsync(ClaimsPrincipal user, int playerId, int itemId, CreateNutritionProfileItemDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int playerId, int itemId);
}

public class NutritionProfileService : INutritionProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public NutritionProfileService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<NutritionProfileItemDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var items = await _context.PlayerNutritionProfiles.Where(p => p.PlayerId == playerId).ToListAsync();
        return items.Select(ToDto).ToList();
    }

    public async Task<NutritionProfileItemDto> CreateAsync(ClaimsPrincipal user, int playerId, CreateNutritionProfileItemDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var item = new PlayerNutritionProfile
        {
            PlayerId = playerId,
            PreferenceType = dto.PreferenceType,
            Category = dto.Category,
            SpecificItem = dto.SpecificItem,
            Severity = dto.Severity,
            Notes = dto.Notes
        };
        _context.PlayerNutritionProfiles.Add(item);
        await _context.SaveChangesAsync();
        return ToDto(item);
    }

    public async Task<NutritionProfileItemDto> UpdateAsync(ClaimsPrincipal user, int playerId, int itemId, CreateNutritionProfileItemDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var item = await _context.PlayerNutritionProfiles.FirstOrDefaultAsync(p => p.Id == itemId && p.PlayerId == playerId)
            ?? throw new NotFoundApiException($"Nutrition profile item {itemId} was not found for player {playerId}.");

        item.PreferenceType = dto.PreferenceType;
        item.Category = dto.Category;
        item.SpecificItem = dto.SpecificItem;
        item.Severity = dto.Severity;
        item.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        return ToDto(item);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int playerId, int itemId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var item = await _context.PlayerNutritionProfiles.FirstOrDefaultAsync(p => p.Id == itemId && p.PlayerId == playerId)
            ?? throw new NotFoundApiException($"Nutrition profile item {itemId} was not found for player {playerId}.");

        _context.PlayerNutritionProfiles.Remove(item);
        await _context.SaveChangesAsync();
    }

    private static NutritionProfileItemDto ToDto(PlayerNutritionProfile p) => new()
    {
        Id = p.Id,
        PlayerId = p.PlayerId,
        PreferenceType = p.PreferenceType,
        Category = p.Category,
        SpecificItem = p.SpecificItem,
        Severity = p.Severity,
        Notes = p.Notes
    };
}
