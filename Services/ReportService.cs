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
    private readonly ISeasonPopulationService _population;

    public ReportService(ApplicationDbContext context, IAccessControlService access,
        ISeasonPopulationService population)
    {
        _population = population;
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

        // §5h: the season-filtered report is HISTORICAL — player identity comes from
        // the population service (stint roster ∪ the narrowed point-in-time arm),
        // never team.Players, which cannot know departed players. The unfiltered
        // report stays the current-roster "who is this team today" view (Q6).
        List<Player> reportPlayers;
        SeasonTeamPopulation? population = null;
        if (seasonId is int sid0)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid0);
            population = await _population.GetTeamPopulationAsync(teamId, sid0);
            reportPlayers = population.Players;
        }
        else
        {
            reportPlayers = team.Players.ToList();
        }
        var playerIds = reportPlayers.Select(p => p.Id).ToList();

        var assessmentQuery = _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => playerIds.Contains(a.PlayerId));
        if (seasonId is int sid1)
            assessmentQuery = assessmentQuery.Where(a => a.SeasonId == sid1);
        var allAssessments = await assessmentQuery.ToListAsync();

        var scores = allAssessments.SelectMany(a => a.StatScores).ToList();

        var averages = scores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => (double)g.Average(s => s.Score));

        // §5h filtered-only per-player stamped counts (Q2 record inclusion = stamps;
        // Q3: no stint-date windowing — the stamps are the windowed truth).
        Dictionary<int, int> testCounts = new(), perfCounts = new();
        if (seasonId is int sid2 && playerIds.Count > 0)
        {
            testCounts = await _context.ObjectiveTestResults
                .Where(t => t.SeasonId == sid2 && playerIds.Contains(t.PlayerId))
                .GroupBy(t => t.PlayerId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
            perfCounts = await _context.MatchPerformances
                .Where(m => m.SeasonId == sid2 && playerIds.Contains(m.PlayerId))
                .GroupBy(m => m.PlayerId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
        }

        var playerAverages = reportPlayers.Select(player =>
        {
            var playerAssessments = allAssessments.Where(a => a.PlayerId == player.Id).ToList();
            var playerScores = playerAssessments.SelectMany(a => a.StatScores).ToList();
            return new PlayerAverageScoreDto
            {
                PlayerId = player.Id,
                PlayerName = player.FullName,
                AverageScore = playerScores.Count != 0 ? (double)playerScores.Average(s => s.Score) : 0,
                AssessmentCount = seasonId != null ? playerAssessments.Count : null,
                ObjectiveTestCount = seasonId != null ? testCounts.GetValueOrDefault(player.Id) : null,
                MatchPerformanceCount = seasonId != null ? perfCounts.GetValueOrDefault(player.Id) : null,
            };
        }).OrderByDescending(p => p.AverageScore).ToList();

        // Active injuries stay an "active now" fact about the CURRENT squad even when
        // filtered (pinned S4 ruling — deliberately not the historical population).
        var currentIds = team.Players.Select(p => p.Id).ToList();
        var activeInjuries = await _context.InjuryRecords
            .Where(i => currentIds.Contains(i.PlayerId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .OrderByDescending(i => i.InjuryDate)
            .ToListAsync();

        SeasonRecordCountsDto? seasonRecords = null;
        List<SeasonRosterStintDto>? seasonRoster = null;
        int? unassigned = null;
        if (seasonId is int sid3)
        {
            seasonRecords = new SeasonRecordCountsDto
            {
                Matches = await _context.MatchResults.CountAsync(m => m.TeamId == teamId && m.SeasonId == sid3),
                TrainingSessions = await _context.TrainingSessions.CountAsync(s => s.TeamId == teamId && s.SeasonId == sid3),
                ScheduledSessions = await _context.ScheduledSessions.CountAsync(s => s.TeamId == teamId && s.SeasonId == sid3),
            };
            seasonRoster = population!.RosterStints.Select(r => new SeasonRosterStintDto
            {
                Id = r.Id,
                SeasonId = r.SeasonId,
                TeamId = r.TeamId,
                TeamName = team.Name,
                PlayerId = r.PlayerId,
                PlayerName = r.Player.FullName,
                JerseyNumber = r.JerseyNumber,
                PositionId = r.PositionId,
                PositionName = r.Position?.Name,
                JoinedAt = r.JoinedAt,
                LeftAt = r.LeftAt,
            }).ToList();
            unassigned = await _population.CountUnassignedAsync(teamId, playerIds);
        }

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
            PlayerCount = reportPlayers.Count,
            AverageScoreByCategory = averages,
            Players = reportPlayers.Select(PlayerService.ToDto).ToList(),
            PlayerAverageScores = playerAverages,
            SeasonRecords = seasonRecords,
            SeasonRoster = seasonRoster,
            UnassignedCount = unassigned,
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
