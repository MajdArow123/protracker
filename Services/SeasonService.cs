using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ISeasonService
{
    Task<List<SeasonDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<SeasonDto?> GetCurrentForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<List<SeasonDto>> GetActiveForCoachAsync(ClaimsPrincipal user);
    Task<SeasonDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateSeasonDto dto);
    Task<SeasonDto> UpdateAsync(ClaimsPrincipal user, int seasonId, CreateSeasonDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int seasonId);
    Task<SeasonSummaryDto> GetSummaryAsync(ClaimsPrincipal user, int seasonId);
    Task LinkPeriodAsync(ClaimsPrincipal user, int seasonId, int periodId, bool link);
}

public class SeasonService : ISeasonService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public SeasonService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<SeasonDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var seasons = await _context.Seasons
            .Include(s => s.Team)
            .Where(s => s.TeamId == teamId)
            .OrderByDescending(s => s.IsActive).ThenByDescending(s => s.StartDate)
            .ToListAsync();
        var counts = await _context.AssessmentPeriods
            .Where(p => p.SeasonId != null && seasons.Select(s => s.Id).Contains(p.SeasonId.Value))
            .GroupBy(p => p.SeasonId!.Value)
            .Select(g => new { SeasonId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SeasonId, x => x.Count);
        return seasons.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList();
    }

    public async Task<SeasonDto?> GetCurrentForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var season = await CurrentSeasonQuery(teamId).Include(s => s.Team).FirstOrDefaultAsync();
        if (season == null) return null;
        var count = await _context.AssessmentPeriods.CountAsync(p => p.SeasonId == season.Id);
        return ToDto(season, count);
    }

    public async Task<List<SeasonDto>> GetActiveForCoachAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var seasons = await _context.Seasons
            .Include(s => s.Team)
            .Where(s => s.IsActive && teamIds.Contains(s.TeamId))
            .OrderBy(s => s.Team.Name)
            .ToListAsync();
        var counts = await _context.AssessmentPeriods
            .Where(p => p.SeasonId != null && seasons.Select(s => s.Id).Contains(p.SeasonId.Value))
            .GroupBy(p => p.SeasonId!.Value)
            .Select(g => new { SeasonId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SeasonId, x => x.Count);
        return seasons.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList();
    }

    public async Task<SeasonDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateSeasonDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        Validate(dto);

        var season = new Season
        {
            TeamId = teamId,
            Name = dto.Name.Trim(),
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            IsActive = dto.IsActive,
            Goals = string.IsNullOrWhiteSpace(dto.Goals) ? null : dto.Goals.Trim(),
        };
        _context.Seasons.Add(season);

        if (dto.IsActive)
            await DeactivateOthersAsync(teamId, excludeId: null);

        await _context.SaveChangesAsync();
        await _context.Entry(season).Reference(s => s.Team).LoadAsync();
        return ToDto(season, 0);
    }

    public async Task<SeasonDto> UpdateAsync(ClaimsPrincipal user, int seasonId, CreateSeasonDto dto)
    {
        var season = await LoadSeasonAsync(seasonId);
        await _access.EnsureCanAccessTeamAsync(user, season.TeamId);
        Validate(dto);

        season.Name = dto.Name.Trim();
        season.StartDate = dto.StartDate;
        season.EndDate = dto.EndDate;
        season.Goals = string.IsNullOrWhiteSpace(dto.Goals) ? null : dto.Goals.Trim();

        if (dto.IsActive && !season.IsActive)
            await DeactivateOthersAsync(season.TeamId, excludeId: season.Id);
        season.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        var count = await _context.AssessmentPeriods.CountAsync(p => p.SeasonId == season.Id);
        return ToDto(season, count);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        await _access.EnsureCanAccessTeamAsync(user, season.TeamId);
        _context.Seasons.Remove(season);
        await _context.SaveChangesAsync();
    }

    public async Task LinkPeriodAsync(ClaimsPrincipal user, int seasonId, int periodId, bool link)
    {
        var season = await LoadSeasonAsync(seasonId);
        await _access.EnsureCanAccessTeamAsync(user, season.TeamId);

        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == periodId)
            ?? throw new NotFoundApiException($"Assessment period {periodId} was not found.");
        if (period.TeamId != season.TeamId)
            throw new ValidationApiException("That assessment period belongs to a different team.");

        period.SeasonId = link ? seasonId : null;
        await _context.SaveChangesAsync();
    }

    public async Task<SeasonSummaryDto> GetSummaryAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        await _access.EnsureCanAccessTeamAsync(user, season.TeamId);

        // Prefer explicitly linked periods; if none are linked, fall back to any of the team's
        // periods that start within the season window so a summary still appears.
        var linkedIds = await _context.AssessmentPeriods
            .Where(p => p.SeasonId == seasonId)
            .Select(p => p.Id)
            .ToListAsync();

        var periodsQuery = _context.AssessmentPeriods.Where(p => p.TeamId == season.TeamId);
        periodsQuery = linkedIds.Count > 0
            ? periodsQuery.Where(p => p.SeasonId == seasonId)
            : periodsQuery.Where(p => p.StartDate >= season.StartDate && p.StartDate <= season.EndDate);

        var periods = await periodsQuery.OrderBy(p => p.StartDate).ToListAsync();
        var periodIds = periods.Select(p => p.Id).ToList();

        // Pull every score in those periods once, then aggregate in memory.
        var scores = await _context.PlayerAssessments
            .Where(a => periodIds.Contains(a.AssessmentPeriodId))
            .SelectMany(a => a.StatScores.Select(s => new
            {
                a.AssessmentPeriodId,
                Category = s.SportStatCategory.Name,
                Score = (double)s.Score,
            }))
            .ToListAsync();

        var summary = new SeasonSummaryDto
        {
            SeasonId = season.Id,
            Name = season.Name,
            StartDate = season.StartDate,
            EndDate = season.EndDate,
        };

        var points = periods
            .Select(p =>
            {
                var pScores = scores.Where(s => s.AssessmentPeriodId == p.Id).ToList();
                return new
                {
                    Period = p,
                    HasData = pScores.Count > 0,
                    Average = pScores.Count > 0 ? pScores.Average(s => s.Score) : 0,
                };
            })
            .Where(x => x.HasData)
            .ToList();

        if (points.Count == 0)
        {
            summary.HasData = false;
            return summary;
        }

        summary.HasData = true;
        summary.Points = points.Select(x => new SeasonPeriodPointDto
        {
            PeriodId = x.Period.Id,
            PeriodName = x.Period.Name,
            StartDate = x.Period.StartDate,
            Average = Math.Round(x.Average, 1),
            IsLinked = x.Period.SeasonId == seasonId,
        }).ToList();

        var first = points.First();
        var last = points.Last();
        summary.StartPeriodName = first.Period.Name;
        summary.EndPeriodName = last.Period.Name;
        summary.StartAverage = Math.Round(first.Average, 1);
        summary.EndAverage = Math.Round(last.Average, 1);
        // Derive from the rounded endpoints so the displayed delta always matches start → end.
        summary.Improvement = Math.Round(summary.EndAverage - summary.StartAverage, 1);

        // Per-category start → end, only for categories present at both endpoints.
        var startByCat = scores.Where(s => s.AssessmentPeriodId == first.Period.Id)
            .GroupBy(s => s.Category).ToDictionary(g => g.Key, g => g.Average(s => s.Score));
        var endByCat = scores.Where(s => s.AssessmentPeriodId == last.Period.Id)
            .GroupBy(s => s.Category).ToDictionary(g => g.Key, g => g.Average(s => s.Score));
        summary.CategoryTrends = startByCat.Keys.Intersect(endByCat.Keys).OrderBy(k => k)
            .Select(k =>
            {
                var start = Math.Round(startByCat[k], 1);
                var end = Math.Round(endByCat[k], 1);
                return new SeasonCategoryTrendDto
                {
                    Category = k,
                    StartAverage = start,
                    EndAverage = end,
                    Improvement = Math.Round(end - start, 1),
                };
            }).ToList();

        return summary;
    }

    // --- helpers ---

    private IQueryable<Season> CurrentSeasonQuery(int teamId)
    {
        var today = DateTime.UtcNow;
        // Active flag wins; otherwise the season whose window contains today; otherwise none.
        return _context.Seasons
            .Where(s => s.TeamId == teamId && (s.IsActive || (s.StartDate <= today && s.EndDate >= today)))
            .OrderByDescending(s => s.IsActive)
            .ThenByDescending(s => s.StartDate);
    }

    private async Task DeactivateOthersAsync(int teamId, int? excludeId)
    {
        var others = await _context.Seasons
            .Where(s => s.TeamId == teamId && s.IsActive && (excludeId == null || s.Id != excludeId))
            .ToListAsync();
        foreach (var o in others) o.IsActive = false;
    }

    private async Task<Season> LoadSeasonAsync(int seasonId) =>
        await _context.Seasons.Include(s => s.Team).FirstOrDefaultAsync(s => s.Id == seasonId)
        ?? throw new NotFoundApiException($"Season {seasonId} was not found.");

    private static void Validate(CreateSeasonDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ValidationApiException("Season name is required.");
        if (dto.EndDate < dto.StartDate)
            throw new ValidationApiException("End date must be on or after the start date.");
    }

    private static SeasonDto ToDto(Season s, int linkedCount) => new()
    {
        Id = s.Id,
        TeamId = s.TeamId,
        TeamName = s.Team?.Name ?? "",
        Name = s.Name,
        StartDate = s.StartDate,
        EndDate = s.EndDate,
        IsActive = s.IsActive,
        Goals = s.Goals,
        LinkedPeriodCount = linkedCount,
    };
}
