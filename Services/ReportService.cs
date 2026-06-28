using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IReportService
{
    Task<PlayerReportDto> GetPlayerReportAsync(ClaimsPrincipal user, int playerId);
    Task<TeamReportDto> GetTeamReportAsync(ClaimsPrincipal user, int teamId);
}

public class ReportService : IReportService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public ReportService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<PlayerReportDto> GetPlayerReportAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players.Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        var assessments = await _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .ToListAsync();

        var injuries = await _context.InjuryRecords.Where(i => i.PlayerId == playerId)
            .OrderByDescending(i => i.InjuryDate).ToListAsync();

        var matches = await _context.MatchPerformances.Where(m => m.PlayerId == playerId)
            .OrderByDescending(m => m.MatchDate).Take(10).ToListAsync();

        var allScores = assessments.SelectMany(a => a.StatScores).ToList();
        var averages = allScores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => g.Average(s => s.Score));

        return new PlayerReportDto
        {
            Player = PlayerService.ToProfileDto(player),
            Assessments = assessments.Select(a => new PlayerAssessmentDto
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
            }).ToList(),
            AverageScoreByCategory = averages,
            Injuries = injuries.Select(i => new InjuryRecordDto
            {
                Id = i.Id,
                PlayerId = i.PlayerId,
                InjuryDate = i.InjuryDate,
                InjuryType = i.InjuryType,
                Severity = i.Severity,
                RecoveryStatus = i.RecoveryStatus,
                Notes = i.Notes,
                ExpectedReturnDate = i.ExpectedReturnDate
            }).ToList(),
            RecentMatches = matches.Select(m => new MatchPerformanceDto
            {
                Id = m.Id,
                PlayerId = m.PlayerId,
                MatchDate = m.MatchDate,
                Opponent = m.Opponent,
                PerformanceRating = m.PerformanceRating,
                Notes = m.Notes,
                SportSpecificStats = m.SportSpecificStats
            }).ToList()
        };
    }

    public async Task<TeamReportDto> GetTeamReportAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);

        var team = await _context.Teams.Include(t => t.Sport).Include(t => t.Players).ThenInclude(p => p.Position)
            .FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        var playerIds = team.Players.Select(p => p.Id).ToList();

        var allAssessments = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => playerIds.Contains(a.PlayerId))
            .ToListAsync();

        var scores = allAssessments.SelectMany(a => a.StatScores).ToList();

        var averages = scores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => g.Average(s => s.Score));

        var playerAverages = playerIds.Select(pid =>
        {
            var playerScores = allAssessments
                .Where(a => a.PlayerId == pid)
                .SelectMany(a => a.StatScores)
                .ToList();
            var player = team.Players.First(p => p.Id == pid);
            return new PlayerAverageScoreDto
            {
                PlayerId = pid,
                PlayerName = player.FullName,
                AverageScore = playerScores.Count != 0 ? playerScores.Average(s => s.Score) : 0
            };
        }).OrderByDescending(p => p.AverageScore).ToList();

        var activeInjuries = await _context.InjuryRecords
            .Where(i => playerIds.Contains(i.PlayerId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .OrderByDescending(i => i.InjuryDate)
            .ToListAsync();

        return new TeamReportDto
        {
            Team = new TeamDto
            {
                Id = team.Id,
                Name = team.Name,
                SportId = team.SportId,
                SportName = team.Sport.Name,
                CoachId = team.CoachId,
                PlayerCount = team.Players.Count
            },
            PlayerCount = team.Players.Count,
            AverageScoreByCategory = averages,
            Players = team.Players.Select(PlayerService.ToDto).ToList(),
            PlayerAverageScores = playerAverages,
            ActiveInjuryCount = activeInjuries.Count(),
            ActiveInjuries = activeInjuries.Select(i => new InjuryRecordDto
            {
                Id = i.Id,
                PlayerId = i.PlayerId,
                InjuryDate = i.InjuryDate,
                InjuryType = i.InjuryType,
                Severity = i.Severity,
                RecoveryStatus = i.RecoveryStatus,
                Notes = i.Notes,
                ExpectedReturnDate = i.ExpectedReturnDate
            }).ToList()
        };
    }
}
