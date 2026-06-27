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

    public AssessmentService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<AssessmentPeriodDto>> GetAccessiblePeriodsAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        return await _context.AssessmentPeriods.Where(p => teamIds.Contains(p.TeamId))
            .Select(ToPeriodDtoExpr()).ToListAsync();
    }

    public async Task<AssessmentPeriodDto> GetPeriodByIdAsync(ClaimsPrincipal user, int id)
    {
        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Assessment period {id} was not found.");
        await _access.EnsureCanAccessTeamAsync(user, period.TeamId);
        return ToPeriodDto(period);
    }

    public async Task<AssessmentPeriodDto> CreatePeriodAsync(ClaimsPrincipal user, CreateAssessmentPeriodDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, dto.TeamId);

        var period = new AssessmentPeriod { Name = dto.Name, StartDate = dto.StartDate, EndDate = dto.EndDate, TeamId = dto.TeamId };
        _context.AssessmentPeriods.Add(period);
        await _context.SaveChangesAsync();
        return ToPeriodDto(period);
    }

    public async Task<AssessmentPeriodDto> UpdatePeriodAsync(ClaimsPrincipal user, int id, CreateAssessmentPeriodDto dto)
    {
        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Assessment period {id} was not found.");
        await _access.EnsureCanAccessTeamAsync(user, period.TeamId);

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
        await _access.EnsureCanAccessTeamAsync(user, period.TeamId);

        _context.AssessmentPeriods.Remove(period);
        await _context.SaveChangesAsync();
    }

    public async Task<List<PlayerAssessmentDto>> GetAccessibleAssessmentsAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Include(a => a.Player)
            .Where(a => teamIds.Contains(a.Player.TeamId))
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

        var period = await _context.AssessmentPeriods.FirstOrDefaultAsync(p => p.Id == dto.AssessmentPeriodId)
            ?? throw new ValidationApiException($"Assessment period {dto.AssessmentPeriodId} does not exist.");

        var assessment = new PlayerAssessment
        {
            PlayerId = dto.PlayerId,
            AssessmentPeriodId = dto.AssessmentPeriodId,
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
        TeamId = p.TeamId
    };

    private static System.Linq.Expressions.Expression<Func<AssessmentPeriod, AssessmentPeriodDto>> ToPeriodDtoExpr() =>
        p => new AssessmentPeriodDto { Id = p.Id, Name = p.Name, StartDate = p.StartDate, EndDate = p.EndDate, TeamId = p.TeamId };

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
