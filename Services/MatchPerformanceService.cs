using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IMatchPerformanceService
{
    Task<List<MatchPerformanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<MatchPerformanceDto> CreateAsync(ClaimsPrincipal user, CreateMatchPerformanceDto dto);
    Task<MatchPerformanceDto> UpdateAsync(ClaimsPrincipal user, int id, CreateMatchPerformanceDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class MatchPerformanceService : IMatchPerformanceService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public MatchPerformanceService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<MatchPerformanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var matches = await _context.MatchPerformances.Where(m => m.PlayerId == playerId)
            .OrderByDescending(m => m.MatchDate).ToListAsync();
        return matches.Select(ToDto).ToList();
    }

    public async Task<MatchPerformanceDto> CreateAsync(ClaimsPrincipal user, CreateMatchPerformanceDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        var match = new MatchPerformance
        {
            PlayerId = dto.PlayerId,
            MatchDate = dto.MatchDate,
            Opponent = dto.Opponent,
            PerformanceRating = dto.PerformanceRating,
            Notes = dto.Notes,
            SportSpecificStats = dto.SportSpecificStats
        };
        _context.MatchPerformances.Add(match);
        await _context.SaveChangesAsync();
        return ToDto(match);
    }

    public async Task<MatchPerformanceDto> UpdateAsync(ClaimsPrincipal user, int id, CreateMatchPerformanceDto dto)
    {
        var match = await _context.MatchPerformances.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw new NotFoundApiException($"Match performance {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, match.PlayerId);

        match.MatchDate = dto.MatchDate;
        match.Opponent = dto.Opponent;
        match.PerformanceRating = dto.PerformanceRating;
        match.Notes = dto.Notes;
        match.SportSpecificStats = dto.SportSpecificStats;
        await _context.SaveChangesAsync();
        return ToDto(match);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var match = await _context.MatchPerformances.FirstOrDefaultAsync(m => m.Id == id)
            ?? throw new NotFoundApiException($"Match performance {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, match.PlayerId);

        _context.MatchPerformances.Remove(match);
        await _context.SaveChangesAsync();
    }

    private static MatchPerformanceDto ToDto(MatchPerformance m) => new()
    {
        Id = m.Id,
        PlayerId = m.PlayerId,
        MatchDate = m.MatchDate,
        Opponent = m.Opponent,
        PerformanceRating = m.PerformanceRating,
        Notes = m.Notes,
        SportSpecificStats = m.SportSpecificStats
    };
}
