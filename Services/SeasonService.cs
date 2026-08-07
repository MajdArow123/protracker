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
    // date: the CLIENT's local calendar date ("yyyy-MM-dd") — see the ruling on
    // GetCurrentForTeamAsync. Null falls back to UTC today.
    Task<SeasonDto?> GetCurrentForTeamAsync(ClaimsPrincipal user, int teamId, string? date = null);
    Task<List<SeasonDto>> GetActiveForOwnerAsync(ClaimsPrincipal user);
    // The account-level list (S5): every season the caller owns, all statuses.
    Task<List<SeasonDto>> GetAllForOwnerAsync(ClaimsPrincipal user);
    Task<SeasonStampedCountsDto> GetStampedCountsAsync(ClaimsPrincipal user, int seasonId);
    Task<SeasonDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateSeasonDto dto);
    Task<SeasonDto> UpdateAsync(ClaimsPrincipal user, int seasonId, CreateSeasonDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int seasonId);
    Task<SeasonSummaryDto> GetSummaryAsync(ClaimsPrincipal user, int seasonId);
    Task LinkPeriodAsync(ClaimsPrincipal user, int seasonId, int periodId, bool link);
    Task SetCurrentAsync(ClaimsPrincipal user, int seasonId);
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
            .Include(s => s.SeasonTeams).ThenInclude(st => st.Team)
            .Where(s => s.SeasonTeams.Any(st => st.TeamId == teamId))
            .OrderByDescending(s => s.Status == SeasonStatus.Active).ThenByDescending(s => s.StartDate)
            .ToListAsync();
        var counts = await LinkedPeriodCountsAsync(seasons.Select(s => s.Id).ToList());
        return seasons.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList();
    }

    public async Task<SeasonDto?> GetCurrentForTeamAsync(ClaimsPrincipal user, int teamId, string? date = null)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        // RULING (Phase 10): "today" is the USER'S LOCAL date, supplied by the client —
        // server-derived UTC today is a fallback only. DateTime.UtcNow.Date is wrong for
        // every user west of UTC in the evening (a Toronto coach at 9pm on a season's
        // final day would lose that season) and east of UTC in the morning.
        var today = ClientLocalDate.ResolveToday(date);
        // Day-granular window check (the S2.1 rule): boundaries are DAYS and the stored
        // values are midnight UTC, so comparing a raw instant would drop a season on
        // its final day. Same sargable half-open pattern as SeasonResolver — no .Date
        // on the column (Npgsql won't translate it on timestamptz).
        var dayStart = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var nextDay = dayStart.AddDays(1);
        // Active status wins; otherwise the season whose window contains today; otherwise none.
        var season = await _context.Seasons
            .Include(s => s.SeasonTeams).ThenInclude(st => st.Team)
            .Where(s => s.SeasonTeams.Any(st => st.TeamId == teamId)
                && (s.Status == SeasonStatus.Active || (s.StartDate < nextDay && s.EndDate >= dayStart)))
            .OrderByDescending(s => s.Status == SeasonStatus.Active)
            .ThenByDescending(s => s.StartDate)
            .FirstOrDefaultAsync();
        if (season == null) return null;
        var count = await _context.AssessmentPeriods.CountAsync(p => p.SeasonId == season.Id);
        return ToDto(season, count);
    }

    public async Task<List<SeasonDto>> GetActiveForOwnerAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var seasons = await _context.Seasons
            .Include(s => s.SeasonTeams).ThenInclude(st => st.Team)
            .Where(s => s.OwnerId == userId && s.Status == SeasonStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .ToListAsync();
        var counts = await LinkedPeriodCountsAsync(seasons.Select(s => s.Id).ToList());
        return seasons.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList();
    }

    public async Task<SeasonDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateSeasonDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        Validate(dto);

        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        var season = new Season
        {
            OwnerId = _access.RequireUserId(user),
            Name = dto.Name.Trim(),
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            // Overlapping Active seasons are allowed — activating one never deactivates others.
            Status = ParseStatus(dto.Status) ?? SeasonStatus.Draft,
            Goals = string.IsNullOrWhiteSpace(dto.Goals) ? null : dto.Goals.Trim(),
        };
        // The team's current default profile becomes this season's starting profile.
        season.SeasonTeams.Add(new SeasonTeam { TeamId = teamId, BenchmarkProfileId = team.BenchmarkProfileId });
        _context.Seasons.Add(season);

        await _context.SaveChangesAsync();
        await _context.Entry(season).Collection(s => s.SeasonTeams).Query().Include(st => st.Team).LoadAsync();
        return ToDto(season, 0);
    }

    public async Task<SeasonDto> UpdateAsync(ClaimsPrincipal user, int seasonId, CreateSeasonDto dto)
    {
        var season = await LoadSeasonAsync(seasonId);
        EnsureOwner(user, season);
        Validate(dto);

        season.Name = dto.Name.Trim();
        season.StartDate = dto.StartDate;
        season.EndDate = dto.EndDate;
        season.Goals = string.IsNullOrWhiteSpace(dto.Goals) ? null : dto.Goals.Trim();

        // Full lifecycle since S5 (the IsActive shim could only reach Active/Draft).
        // Absent status = unchanged; overlap of Active seasons stays allowed.
        if (ParseStatus(dto.Status) is SeasonStatus newStatus)
            season.Status = newStatus;

        await _context.SaveChangesAsync();
        var count = await _context.AssessmentPeriods.CountAsync(p => p.SeasonId == season.Id);
        return ToDto(season, count);
    }

    public async Task<List<SeasonDto>> GetAllForOwnerAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var seasons = await _context.Seasons
            .Include(s => s.SeasonTeams).ThenInclude(st => st.Team)
            .Where(s => s.OwnerId == userId)
            .OrderByDescending(s => s.Status == SeasonStatus.Active).ThenByDescending(s => s.StartDate)
            .ToListAsync();
        var counts = await LinkedPeriodCountsAsync(seasons.Select(s => s.Id).ToList());
        return seasons.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList();
    }

    // Row-stamp counts (S3/S4 mechanism), owner-only. Deliberately NOT the period-linkage
    // summary — the two can disagree; this one exists for the edit-dates warning, where
    // "records stamped to this season" is exactly the number that will NOT be re-resolved
    // until S7 backfill tooling ships.
    public async Task<SeasonStampedCountsDto> GetStampedCountsAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        EnsureOwner(user, season);
        return new SeasonStampedCountsDto
        {
            SeasonId = seasonId,
            Matches = await _context.MatchResults.CountAsync(m => m.SeasonId == seasonId),
            Assessments = await _context.PlayerAssessments.CountAsync(a => a.SeasonId == seasonId),
            ObjectiveTests = await _context.ObjectiveTestResults.CountAsync(t => t.SeasonId == seasonId),
            EvidenceScores = await _context.EvidenceBasedScores.CountAsync(s => s.SeasonId == seasonId),
            MatchPerformances = await _context.MatchPerformances.CountAsync(m => m.SeasonId == seasonId),
            Lineups = await _context.Lineups.CountAsync(l => l.SeasonId == seasonId),
            TrainingSessions = await _context.TrainingSessions.CountAsync(s => s.SeasonId == seasonId),
            ScheduledSessions = await _context.ScheduledSessions.CountAsync(s => s.SeasonId == seasonId),
            ImprovementPlans = await _context.ImprovementPlans.CountAsync(p => p.SeasonId == seasonId),
        };
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        EnsureOwner(user, season);
        _context.Seasons.Remove(season);
        await _context.SaveChangesAsync();
    }

    public async Task SetCurrentAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        EnsureOwner(user, season);
        var userId = _access.RequireUserId(user);
        var account = await _context.Users.FirstAsync(u => u.Id == userId);
        account.CurrentSeasonId = season.Id;
        await _context.SaveChangesAsync();
    }

    public async Task LinkPeriodAsync(ClaimsPrincipal user, int seasonId, int periodId, bool link)
    {
        var season = await LoadSeasonAsync(seasonId);
        EnsureOwner(user, season);

        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == periodId)
            ?? throw new NotFoundApiException($"Assessment period {periodId} was not found.");
        // Player-scoped periods have TeamId null and never belong to a team season.
        if (period.TeamId == null || !season.SeasonTeams.Any(st => st.TeamId == period.TeamId.Value))
            throw new ValidationApiException("That assessment period belongs to a team outside this season.");

        period.SeasonId = link ? seasonId : null;
        await _context.SaveChangesAsync();
    }

    public async Task<SeasonSummaryDto> GetSummaryAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await LoadSeasonAsync(seasonId);
        await EnsureCanReadAsync(user, season);
        var teamIds = season.SeasonTeams.Select(st => st.TeamId).ToList();

        // Prefer explicitly linked periods; if none are linked, fall back to any of the
        // participating teams' periods that start within the season window so a summary
        // still appears.
        var linkedIds = await _context.AssessmentPeriods
            .Where(p => p.SeasonId == seasonId)
            .Select(p => p.Id)
            .ToListAsync();

        var periodsQuery = _context.AssessmentPeriods
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value));
        periodsQuery = linkedIds.Count > 0
            ? periodsQuery.Where(p => p.SeasonId == seasonId)
            : periodsQuery.Where(p => p.StartDate >= season.StartDate && p.StartDate <= season.EndDate);

        var periods = await periodsQuery.OrderBy(p => p.StartDate).ToListAsync();
        var periodIds = periods.Select(p => p.Id).ToList();

        // Pull every score in those periods once, then aggregate in memory. Queried from
        // the score side (a plain join): the previous parent-side SelectMany needed SQL
        // APPLY, which the SQLite test provider can't translate.
        var scores = await _context.PlayerStatScores
            .Where(s => periodIds.Contains(s.PlayerAssessment.AssessmentPeriodId))
            .Select(s => new
            {
                s.PlayerAssessment.AssessmentPeriodId,
                Category = s.SportStatCategory.Name,
                Score = (double)s.Score,
            })
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

    private async Task<Dictionary<int, int>> LinkedPeriodCountsAsync(List<int> seasonIds)
    {
        if (seasonIds.Count == 0) return new Dictionary<int, int>();
        return await _context.AssessmentPeriods
            .Where(p => p.SeasonId != null && seasonIds.Contains(p.SeasonId.Value))
            .GroupBy(p => p.SeasonId!.Value)
            .Select(g => new { SeasonId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SeasonId, x => x.Count);
    }

    private async Task<Season> LoadSeasonAsync(int seasonId) =>
        await _context.Seasons
            .Include(s => s.SeasonTeams).ThenInclude(st => st.Team)
            .FirstOrDefaultAsync(s => s.Id == seasonId)
        ?? throw new NotFoundApiException($"Season {seasonId} was not found.");

    // OwnerId governs create/edit/lifecycle only.
    private void EnsureOwner(ClaimsPrincipal user, Season season)
    {
        if (user.IsInRole("Admin")) return;
        if (season.OwnerId != _access.RequireUserId(user))
            throw new ForbiddenApiException("Only the season's owner can change it.");
    }

    // Read access follows team participation (assistant coaches and athletes on a
    // participating team can read), with the owner always able to read their own season.
    private async Task EnsureCanReadAsync(ClaimsPrincipal user, Season season)
    {
        if (user.IsInRole("Admin")) return;
        if (season.OwnerId == _access.RequireUserId(user)) return;
        foreach (var teamId in season.SeasonTeams.Select(st => st.TeamId))
        {
            try
            {
                await _access.EnsureCanAccessTeamAsync(user, teamId);
                return;
            }
            catch (ForbiddenApiException)
            {
                // Not this team — try the next participating team.
            }
        }
        throw new ForbiddenApiException("You do not have access to this season.");
    }

    private static void Validate(CreateSeasonDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ValidationApiException("Season name is required.");
        if (dto.EndDate < dto.StartDate)
            throw new ValidationApiException("End date must be on or after the start date.");
    }

    // Null/empty = "not specified" (create defaults Draft, update keeps the current
    // status); an unknown value 400s — deliberately NOT a silent ignore (ParseFoot rule).
    private static SeasonStatus? ParseStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        if (Enum.TryParse<SeasonStatus>(status, ignoreCase: true, out var parsed)) return parsed;
        throw new ValidationApiException($"Unknown season status '{status}'.");
    }

    private static SeasonDto ToDto(Season s, int linkedCount) => new()
    {
        Id = s.Id,
        Teams = s.SeasonTeams
            .OrderBy(st => st.Team?.Name)
            .Select(st => new SeasonTeamRefDto { Id = st.TeamId, Name = st.Team?.Name ?? "" })
            .ToList(),
        Name = s.Name,
        StartDate = s.StartDate,
        EndDate = s.EndDate,
        Status = s.Status.ToString(),
        Goals = s.Goals,
        LinkedPeriodCount = linkedCount,
    };
}
