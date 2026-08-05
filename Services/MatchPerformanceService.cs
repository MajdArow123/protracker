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
    private readonly ISeasonStamper _seasons;

    public MatchPerformanceService(ApplicationDbContext context, IAccessControlService access,
        ISeasonStamper seasons)
    {
        _seasons = seasons;
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

        // Player-context season stamp on the match's own date — metadata, never blocks (S3).
        var stamp = await _seasons.ForPlayerAsync(dto.PlayerId, DateOnly.FromDateTime(dto.MatchDate));
        var match = new MatchPerformance
        {
            PlayerId = dto.PlayerId,
            MatchDate = dto.MatchDate,
            Opponent = dto.Opponent,
            PerformanceRating = dto.PerformanceRating,
            Notes = dto.Notes,
            SportSpecificStats = dto.SportSpecificStats,
            SeasonId = stamp.SeasonId,
        };
        _context.MatchPerformances.Add(match);
        await _context.SaveChangesAsync();
        var result = ToDto(match);
        result.SeasonNotice = stamp.Notice;
        return result;
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
