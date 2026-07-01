using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IDashboardService
{
    Task<CoachDashboardDto> GetCoachDashboardAsync(ClaimsPrincipal user);
    Task<PlayerDashboardDto> GetPlayerDashboardAsync(ClaimsPrincipal user, int playerId);
}

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public DashboardService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<CoachDashboardDto> GetCoachDashboardAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);

        var teams = await _context.Teams.Where(t => teamIds.Contains(t.Id))
            .Include(t => t.Sport).Include(t => t.Players)
            .ToListAsync();

        return new CoachDashboardDto
        {
            TotalTeams = teams.Count,
            TotalPlayers = teams.Sum(t => t.Players.Count),
            Teams = teams.Select(t => new TeamDto
            {
                Id = t.Id,
                Name = t.Name,
                SportId = t.SportId,
                SportName = t.Sport.Name,
                CoachId = t.CoachId,
                PlayerCount = t.Players.Count
            }).ToList()
        };
    }

    public async Task<PlayerDashboardDto> GetPlayerDashboardAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players.Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new Common.NotFoundApiException($"Player {playerId} was not found.");

        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .ToListAsync();

        var latest = assessments.FirstOrDefault();
        double? latestAverage = latest != null && latest.StatScores.Any()
            ? (double)latest.StatScores.Average(s => s.Score)
            : null;

        return new PlayerDashboardDto
        {
            Player = PlayerService.ToProfileDto(player),
            TotalAssessments = assessments.Count,
            LatestAverageScore = latestAverage,
            RecentAssessments = assessments.Take(5).Select(a => new PlayerAssessmentDto
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
            }).ToList()
        };
    }
}
