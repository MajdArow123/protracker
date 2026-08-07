using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IMatchPerformanceService
{
    Task<List<MatchPerformanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int? seasonId = null);
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

    public async Task<List<MatchPerformanceDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int? seasonId = null)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var query = _context.MatchPerformances.Where(m => m.PlayerId == playerId);
        if (seasonId is int sid)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid);
            query = query.Where(m => m.SeasonId == sid);
        }
        var matches = await query.OrderByDescending(m => m.MatchDate).ToListAsync();
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

        var dateChanged = match.MatchDate != dto.MatchDate;
        match.MatchDate = dto.MatchDate;
        match.Opponent = dto.Opponent;
        match.PerformanceRating = dto.PerformanceRating;
        match.Notes = dto.Notes;
        match.SportSpecificStats = dto.SportSpecificStats;

        // Date-changing update: re-resolve (player context) and restamp. Metadata,
        // never blocks; untouched dates never re-resolve.
        SeasonResolutionNoticeDto? seasonNotice = null;
        if (dateChanged)
        {
            var restamp = await _seasons.RestampForPlayerAsync(
                match.PlayerId, DateOnly.FromDateTime(dto.MatchDate), match.SeasonId);
            match.SeasonId = restamp.SeasonId;
            seasonNotice = restamp.Notice;
        }
        await _context.SaveChangesAsync();
        var result = ToDto(match);
        result.SeasonNotice = seasonNotice;
        return result;
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
