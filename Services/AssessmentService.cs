using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAssessmentService
{
    Task<List<AssessmentPeriodDto>> GetAccessiblePeriodsAsync(ClaimsPrincipal user);
    Task<AssessmentPeriodDto> GetPeriodByIdAsync(ClaimsPrincipal user, int id);
    Task<AssessmentPeriodDto> CreatePeriodAsync(ClaimsPrincipal user, CreateAssessmentPeriodDto dto);
    Task<AssessmentPeriodDto> UpdatePeriodAsync(ClaimsPrincipal user, int id, CreateAssessmentPeriodDto dto);
    Task DeletePeriodAsync(ClaimsPrincipal user, int id);

    Task<List<PlayerAssessmentDto>> GetAccessibleAssessmentsAsync(ClaimsPrincipal user);
    Task<PlayerAssessmentDto> GetAssessmentByIdAsync(ClaimsPrincipal user, int id);
    Task<List<PlayerAssessmentDto>> GetAssessmentsForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<PlayerAssessmentDto> CreateAssessmentAsync(ClaimsPrincipal user, CreatePlayerAssessmentDto dto);
    Task<PlayerAssessmentDto> UpdateAssessmentAsync(ClaimsPrincipal user, int id, CreatePlayerAssessmentDto dto);
    Task DeleteAssessmentAsync(ClaimsPrincipal user, int id);
}

public class AssessmentService : IAssessmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IPersonalGoalService _goals;

    public AssessmentService(ApplicationDbContext context, IAccessControlService access, IPersonalGoalService goals)
    {
        _context = context;
        _access = access;
        _goals = goals;
    }

    public async Task<List<AssessmentPeriodDto>> GetAccessiblePeriodsAsync(ClaimsPrincipal user)
    {
        // Solo athletes see their own player-scoped periods; everyone still sees
        // the periods of teams they can access (a connected ex-solo athlete has both).
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var query = _context.AssessmentPeriods
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value));

        if (_access.IsSoloAthlete(user) || user.IsInRole("Athlete"))
        {
            var userId = _access.RequireUserId(user);
            query = _context.AssessmentPeriods.Where(p =>
                (p.TeamId != null && teamIds.Contains(p.TeamId.Value))
                || (p.PlayerId != null && p.Player!.UserId == userId));
        }

        return await query.Select(ToPeriodDtoExpr()).ToListAsync();
    }

    // Team-scoped periods require team access; player-scoped (solo) periods require
    // ownership of that player.
    private async Task EnsureCanAccessPeriodAsync(ClaimsPrincipal user, AssessmentPeriod period)
    {
        if (period.PlayerId != null)
            await _access.EnsureCanAccessPlayerAsync(user, period.PlayerId.Value);
        else if (period.TeamId != null)
            await _access.EnsureCanAccessTeamAsync(user, period.TeamId.Value);
        else
            throw new ForbiddenApiException();
    }

    public async Task<AssessmentPeriodDto> GetPeriodByIdAsync(ClaimsPrincipal user, int id)
    {
        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Assessment period {id} was not found.");
        await EnsureCanAccessPeriodAsync(user, period);
        return ToPeriodDto(period);
    }

    public async Task<AssessmentPeriodDto> CreatePeriodAsync(ClaimsPrincipal user, CreateAssessmentPeriodDto dto)
    {
        AssessmentPeriod period;
        if (dto.TeamId is int teamId)
        {
            await _access.EnsureCanAccessTeamAsync(user, teamId);
            period = new AssessmentPeriod { Name = dto.Name, StartDate = dto.StartDate, EndDate = dto.EndDate, TeamId = teamId };
        }
        else
        {
            // No team = a solo athlete creating a personal period for themselves.
            if (!_access.IsSoloAthlete(user))
                throw new ValidationApiException("TeamId is required.");
            var player = await _access.RequireOwnPlayerAsync(user);
            period = new AssessmentPeriod { Name = dto.Name, StartDate = dto.StartDate, EndDate = dto.EndDate, PlayerId = player.Id };
        }

        _context.AssessmentPeriods.Add(period);
        await _context.SaveChangesAsync();
        return ToPeriodDto(period);
    }

    public async Task<AssessmentPeriodDto> UpdatePeriodAsync(ClaimsPrincipal user, int id, CreateAssessmentPeriodDto dto)
    {
        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Assessment period {id} was not found.");
        await EnsureCanAccessPeriodAsync(user, period);

        period.Name = dto.Name;
        period.StartDate = dto.StartDate;
        period.EndDate = dto.EndDate;
        await _context.SaveChangesAsync();
        return ToPeriodDto(period);
    }

    public async Task DeletePeriodAsync(ClaimsPrincipal user, int id)
    {
        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Assessment period {id} was not found.");
        await EnsureCanAccessPeriodAsync(user, period);

        _context.AssessmentPeriods.Remove(period);
        await _context.SaveChangesAsync();
    }

    public async Task<List<PlayerAssessmentDto>> GetAccessibleAssessmentsAsync(ClaimsPrincipal user)
    {
        if (_access.IsSoloAthlete(user))
        {
            var player = await _access.RequireOwnPlayerAsync(user);
            return await GetAssessmentsForPlayerAsync(user, player.Id);
        }

        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Include(a => a.Player)
            .Where(a => a.Player.TeamId != null && teamIds.Contains(a.Player.TeamId.Value))
            .ToListAsync();
        return assessments.Select(ToAssessmentDto).ToList();
    }

    public async Task<PlayerAssessmentDto> GetAssessmentByIdAsync(ClaimsPrincipal user, int id)
    {
        var assessment = await LoadAssessmentAsync(id);
        await _access.EnsureCanAccessPlayerAsync(user, assessment.PlayerId);
        return ToAssessmentDto(assessment);
    }

    public async Task<List<PlayerAssessmentDto>> GetAssessmentsForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .ToListAsync();
        return assessments.Select(ToAssessmentDto).ToList();
    }

    public async Task<PlayerAssessmentDto> CreateAssessmentAsync(ClaimsPrincipal user, CreatePlayerAssessmentDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        // Solo athletes may omit the period (0): their "Personal Training" period is
        // created on first use and reused after that.
        AssessmentPeriod period;
        if (dto.AssessmentPeriodId == 0)
        {
            if (!_access.IsSoloAthlete(user))
                throw new ValidationApiException("AssessmentPeriodId is required.");
            period = await GetOrCreatePersonalPeriodAsync(dto.PlayerId);
        }
        else
        {
            period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == dto.AssessmentPeriodId)
                ?? throw new ValidationApiException($"Assessment period {dto.AssessmentPeriodId} does not exist.");
            // A period must belong to the player being assessed (their team's, or their own).
            await EnsureCanAccessPeriodAsync(user, period);
        }

        var assessment = new PlayerAssessment
        {
            PlayerId = dto.PlayerId,
            AssessmentPeriodId = period.Id,
            DateRecorded = dto.DateRecorded,
            Notes = dto.Notes
        };
        _context.PlayerAssessments.Add(assessment);
        await _context.SaveChangesAsync();

        foreach (var score in dto.StatScores)
        {
            _context.PlayerStatScores.Add(new PlayerStatScore
            {
                PlayerAssessmentId = assessment.Id,
                SportStatCategoryId = score.SportStatCategoryId,
                Score = score.Score
            });
        }
        await _context.SaveChangesAsync();

        // Auto-link: update any active Performance goals tied to these stat categories.
        var categoryScores = dto.StatScores
            .GroupBy(s => s.SportStatCategoryId)
            .ToDictionary(g => g.Key, g => g.Last().Score);
        await _goals.SyncFromAssessmentAsync(dto.PlayerId, categoryScores);

        assessment.AssessmentPeriod = period;
        return await GetAssessmentByIdAsync(user, assessment.Id);
    }

    public async Task<PlayerAssessmentDto> UpdateAssessmentAsync(ClaimsPrincipal user, int id, CreatePlayerAssessmentDto dto)
    {
        var assessment = await _context.PlayerAssessments.FirstOrDefaultAsync(a => a.Id == id)
            ?? throw new NotFoundApiException($"Assessment {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, assessment.PlayerId);

        assessment.DateRecorded = dto.DateRecorded;
        assessment.Notes = dto.Notes;
        await _context.SaveChangesAsync();

        return await GetAssessmentByIdAsync(user, id);
    }

    public async Task DeleteAssessmentAsync(ClaimsPrincipal user, int id)
    {
        var assessment = await _context.PlayerAssessments.FirstOrDefaultAsync(a => a.Id == id)
            ?? throw new NotFoundApiException($"Assessment {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, assessment.PlayerId);

        _context.PlayerAssessments.Remove(assessment);
        await _context.SaveChangesAsync();
    }

    // The long-running catch-all period a solo athlete's self-assessments live in.
    private async Task<AssessmentPeriod> GetOrCreatePersonalPeriodAsync(int playerId)
    {
        var existing = await _context.AssessmentPeriods
            .Where(p => p.PlayerId == playerId)
            .OrderByDescending(p => p.EndDate)
            .FirstOrDefaultAsync();
        if (existing != null) return existing;

        var period = new AssessmentPeriod
        {
            Name = "Personal Training",
            PlayerId = playerId,
            StartDate = DateTime.UtcNow.Date,
            EndDate = DateTime.UtcNow.Date.AddYears(5),
        };
        _context.AssessmentPeriods.Add(period);
        await _context.SaveChangesAsync();
        return period;
    }

    private async Task<PlayerAssessment> LoadAssessmentAsync(int id) =>
        await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .FirstOrDefaultAsync(a => a.Id == id)
        ?? throw new NotFoundApiException($"Assessment {id} was not found.");

    private static AssessmentPeriodDto ToPeriodDto(AssessmentPeriod p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        StartDate = p.StartDate,
        EndDate = p.EndDate,
        TeamId = p.TeamId,
        PlayerId = p.PlayerId
    };

    private static System.Linq.Expressions.Expression<Func<AssessmentPeriod, AssessmentPeriodDto>> ToPeriodDtoExpr() =>
        p => new AssessmentPeriodDto { Id = p.Id, Name = p.Name, StartDate = p.StartDate, EndDate = p.EndDate, TeamId = p.TeamId, PlayerId = p.PlayerId, SeasonId = p.SeasonId };

    private static PlayerAssessmentDto ToAssessmentDto(PlayerAssessment a) => new()
    {
        Id = a.Id,
        PlayerId = a.PlayerId,
        AssessmentPeriodId = a.AssessmentPeriodId,
        AssessmentPeriodName = a.AssessmentPeriod?.Name ?? "",
        DateRecorded = a.DateRecorded,
        Notes = a.Notes,
        StatScores = a.StatScores.Select(s => new PlayerStatScoreDto
        {
            Id = s.Id,
            PlayerAssessmentId = s.PlayerAssessmentId,
            SportStatCategoryId = s.SportStatCategoryId,
            StatCategoryName = s.SportStatCategory?.Name ?? "",
            Score = s.Score
        }).ToList()
    };
}
