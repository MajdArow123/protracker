using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IReportService
{
    Task<PlayerReportDto> GetPlayerReportAsync(ClaimsPrincipal user, int playerId, int? seasonId = null);
    Task<TeamReportDto> GetTeamReportAsync(ClaimsPrincipal user, int teamId, int? seasonId = null);
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

    public async Task<PlayerReportDto> GetPlayerReportAsync(ClaimsPrincipal user, int playerId, int? seasonId = null)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);

        var player = await _context.Players.Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        Season? season = null;
        if (seasonId is int sid)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid);
            season = await _context.Seasons.FirstAsync(s => s.Id == sid);
        }

        var assessmentQuery = _context.PlayerAssessments
            .Include(a => a.AssessmentPeriod)
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId);
        if (season != null)
            assessmentQuery = assessmentQuery.Where(a => a.SeasonId == season.Id);
        var assessments = await assessmentQuery
            .OrderByDescending(a => a.DateRecorded)
            .ToListAsync();

        // Injuries are span-bearing records (settled exclusion ruling): they have no
        // SeasonId and are season-scoped by WINDOW OVERLAP at read time — an injury
        // counts if it was open at any point inside the season (day-granular, same
        // half-open pattern as SeasonResolver; open injuries have no end).
        var injuryQuery = _context.InjuryRecords.Where(i => i.PlayerId == playerId);
        if (season != null)
        {
            var seasonEndNextDay = season.EndDate.Date.AddDays(1);
            injuryQuery = injuryQuery.Where(i => i.InjuryDate < seasonEndNextDay
                && (i.RecoveredDate == null || i.RecoveredDate >= season.StartDate));
        }
        var injuries = await injuryQuery
            .OrderByDescending(i => i.InjuryDate).ToListAsync();

        var matchQuery = _context.MatchPerformances.Where(m => m.PlayerId == playerId);
        if (season != null)
            matchQuery = matchQuery.Where(m => m.SeasonId == season.Id);
        var matches = await matchQuery
            .OrderByDescending(m => m.MatchDate).Take(10).ToListAsync();

        var allScores = assessments.SelectMany(a => a.StatScores).ToList();
        var averages = allScores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => (double)g.Average(s => s.Score));

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

    public async Task<TeamReportDto> GetTeamReportAsync(ClaimsPrincipal user, int teamId, int? seasonId = null)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);

        var team = await _context.Teams.Include(t => t.Sport).Include(t => t.Players).ThenInclude(p => p.Position)
            .FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        var playerIds = team.Players.Select(p => p.Id).ToList();

        var assessmentQuery = _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => playerIds.Contains(a.PlayerId));
        if (seasonId is int sid)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid);
            assessmentQuery = assessmentQuery.Where(a => a.SeasonId == sid);
        }
        var allAssessments = await assessmentQuery.ToListAsync();

        var scores = allAssessments.SelectMany(a => a.StatScores).ToList();

        var averages = scores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => (double)g.Average(s => s.Score));

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
                AverageScore = playerScores.Count != 0 ? (double)playerScores.Average(s => s.Score) : 0
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
            // Until S6 lands roster history, a season-filtered team report is
            // "TODAY's roster ∩ that season's assessments" — a plausible-looking
            // wrong answer for squads that changed. The flag lets the UI caveat it.
            RosterIsCurrentNotHistorical = seasonId != null,
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
