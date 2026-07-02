using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IMatchService
{
    Task<List<MatchResultDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<MatchResultDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateMatchResultDto dto);
    Task<MatchResultDto> UpdateAsync(ClaimsPrincipal user, int matchId, CreateMatchResultDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int matchId);
    Task<MatchResultDto> SaveRatingsAsync(ClaimsPrincipal user, int matchId, SaveMatchRatingsDto dto);
    Task<List<PlayerMatchRatingDto>> GetPlayerRatingsAsync(ClaimsPrincipal user, int playerId);
}

public class MatchService : IMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public MatchService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<MatchResultDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var matches = await _context.MatchResults
            .Include(m => m.Team)
            .Include(m => m.Ratings).ThenInclude(r => r.Player)
            .Where(m => m.TeamId == teamId)
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();
        return matches.Select(ToDto).ToList();
    }

    public async Task<MatchResultDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateMatchResultDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var match = new MatchResult
        {
            TeamId = teamId,
            OpponentName = dto.OpponentName.Trim(),
            MatchDate = dto.MatchDate,
            HomeScore = dto.HomeScore,
            AwayScore = dto.AwayScore,
            IsHome = dto.IsHome,
            Venue = dto.Venue,
            Competition = dto.Competition,
            Notes = dto.Notes,
        };
        _context.MatchResults.Add(match);
        await _context.SaveChangesAsync();
        await _context.Entry(match).Reference(m => m.Team).LoadAsync();
        return ToDto(match);
    }

    public async Task<MatchResultDto> UpdateAsync(ClaimsPrincipal user, int matchId, CreateMatchResultDto dto)
    {
        var match = await LoadMatchAsync(matchId);
        await _access.EnsureCanAccessTeamAsync(user, match.TeamId);

        match.OpponentName = dto.OpponentName.Trim();
        match.MatchDate = dto.MatchDate;
        match.HomeScore = dto.HomeScore;
        match.AwayScore = dto.AwayScore;
        match.IsHome = dto.IsHome;
        match.Venue = dto.Venue;
        match.Competition = dto.Competition;
        match.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        return ToDto(match);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int matchId)
    {
        var match = await LoadMatchAsync(matchId);
        await _access.EnsureCanAccessTeamAsync(user, match.TeamId);
        _context.MatchResults.Remove(match);
        await _context.SaveChangesAsync();
    }

    public async Task<MatchResultDto> SaveRatingsAsync(ClaimsPrincipal user, int matchId, SaveMatchRatingsDto dto)
    {
        var match = await LoadMatchAsync(matchId);
        await _access.EnsureCanAccessTeamAsync(user, match.TeamId);

        // Only players on this match's team may be rated.
        var teamPlayerIds = await _context.Players.Where(p => p.TeamId == match.TeamId).Select(p => p.Id).ToListAsync();
        var invalid = dto.Ratings.Select(r => r.PlayerId).Where(pid => !teamPlayerIds.Contains(pid)).ToList();
        if (invalid.Count > 0)
            throw new ValidationApiException($"Players {string.Join(", ", invalid)} are not on this team.");

        // Replace the whole set of ratings for this match.
        _context.PlayerMatchRatings.RemoveRange(match.Ratings);
        foreach (var r in dto.Ratings)
        {
            _context.PlayerMatchRatings.Add(new PlayerMatchRating
            {
                MatchResultId = matchId,
                PlayerId = r.PlayerId,
                Rating = r.Rating,
                Goals = r.Goals,
                Assists = r.Assists,
                YellowCards = r.YellowCards,
                RedCards = r.RedCards,
                MinutesPlayed = r.MinutesPlayed,
                Notes = r.Notes,
            });
        }
        await _context.SaveChangesAsync();

        var reloaded = await _context.MatchResults
            .Include(m => m.Team)
            .Include(m => m.Ratings).ThenInclude(r => r.Player)
            .FirstAsync(m => m.Id == matchId);
        return ToDto(reloaded);
    }

    public async Task<List<PlayerMatchRatingDto>> GetPlayerRatingsAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var ratings = await _context.PlayerMatchRatings
            .Include(r => r.Player)
            .Include(r => r.MatchResult)
            .Where(r => r.PlayerId == playerId)
            .OrderByDescending(r => r.MatchResult.MatchDate)
            .ToListAsync();
        return ratings.Select(r => new PlayerMatchRatingDto
        {
            Id = r.Id,
            MatchResultId = r.MatchResultId,
            PlayerId = r.PlayerId,
            PlayerName = r.Player?.FullName ?? "",
            Rating = r.Rating,
            Goals = r.Goals,
            Assists = r.Assists,
            YellowCards = r.YellowCards,
            RedCards = r.RedCards,
            MinutesPlayed = r.MinutesPlayed,
            Notes = r.Notes,
            MatchDate = r.MatchResult?.MatchDate,
            OpponentName = r.MatchResult?.OpponentName,
        }).ToList();
    }

    private async Task<MatchResult> LoadMatchAsync(int matchId)
    {
        return await _context.MatchResults
            .Include(m => m.Team)
            .Include(m => m.Ratings).ThenInclude(r => r.Player)
            .FirstOrDefaultAsync(m => m.Id == matchId)
            ?? throw new NotFoundApiException($"Match {matchId} was not found.");
    }

    private static MatchResultDto ToDto(MatchResult m)
    {
        var ourScore = m.IsHome ? m.HomeScore : m.AwayScore;
        var oppScore = m.IsHome ? m.AwayScore : m.HomeScore;
        var result = ourScore > oppScore ? MatchOutcome.Win : ourScore == oppScore ? MatchOutcome.Draw : MatchOutcome.Loss;
        return new MatchResultDto
        {
            Id = m.Id,
            TeamId = m.TeamId,
            TeamName = m.Team?.Name ?? "",
            OpponentName = m.OpponentName,
            MatchDate = m.MatchDate,
            HomeScore = m.HomeScore,
            AwayScore = m.AwayScore,
            IsHome = m.IsHome,
            OurScore = ourScore,
            OpponentScore = oppScore,
            Result = result,
            Venue = m.Venue,
            Competition = m.Competition,
            Notes = m.Notes,
            Ratings = (m.Ratings ?? new List<PlayerMatchRating>())
                .OrderByDescending(r => r.Rating)
                .Select(r => new PlayerMatchRatingDto
                {
                    Id = r.Id,
                    MatchResultId = r.MatchResultId,
                    PlayerId = r.PlayerId,
                    PlayerName = r.Player?.FullName ?? "",
                    Rating = r.Rating,
                    Goals = r.Goals,
                    Assists = r.Assists,
                    YellowCards = r.YellowCards,
                    RedCards = r.RedCards,
                    MinutesPlayed = r.MinutesPlayed,
                    Notes = r.Notes,
                }).ToList(),
        };
    }
}
