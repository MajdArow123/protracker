using System.Security.Claims;
using System.Text.Json;
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
    // Solo athletes: personal (player-scoped, team-less) match log.
    Task<List<MatchResultDto>> GetMySoloMatchesAsync(ClaimsPrincipal user);
    Task<MatchResultDto> CreateForSelfAsync(ClaimsPrincipal user, CreateMatchResultDto dto);
}

public class MatchService : IMatchService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IEvidenceScoringEngine _evidence;
    private readonly ISeasonStamper _seasons;
    private readonly ILogger<MatchService> _logger;

    public MatchService(ApplicationDbContext context, IAccessControlService access,
        IEvidenceScoringEngine evidence, ISeasonStamper seasons, ILogger<MatchService> logger)
    {
        _context = context;
        _access = access;
        _evidence = evidence;
        _seasons = seasons;
        _logger = logger;
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
        var sportId = await _context.Teams.Where(t => t.Id == teamId).Select(t => t.SportId).FirstAsync();
        var match = new MatchResult
        {
            TeamId = teamId,
            OpponentName = dto.OpponentName.Trim(),
            MatchDate = dto.MatchDate,
            Status = dto.Status,
            // A Scheduled fixture has no score — zero the stored columns (masked to
            // null at the DTO layer) rather than persisting whatever the client sent.
            HomeScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.HomeScore,
            AwayScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.AwayScore,
            IsHome = dto.IsHome,
            ScoreFormat = MatchResult.FormatForSport(sportId),
            SetScores = dto.Status == MatchStatus.Scheduled || string.IsNullOrWhiteSpace(dto.SetScores)
                ? null : dto.SetScores.Trim(),
            Venue = dto.Venue,
            Competition = dto.Competition,
            Notes = dto.Notes,
            OpponentFormation = NormalizeOptional(dto.OpponentFormation),
            ScoutingNotes = NormalizeOptional(dto.ScoutingNotes),
        };
        // Season stamping is metadata and never blocks the save (S3 ruling).
        var stamp = await _seasons.ForTeamAsync(teamId, DateOnly.FromDateTime(dto.MatchDate));
        match.SeasonId = stamp.SeasonId;
        _context.MatchResults.Add(match);
        await _context.SaveChangesAsync();
        await _context.Entry(match).Reference(m => m.Team).LoadAsync();
        var result = ToDto(match);
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    public async Task<List<MatchResultDto>> GetMySoloMatchesAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var matches = await _context.MatchResults
            .Include(m => m.Ratings).ThenInclude(r => r.Player)
            .Where(m => m.PlayerId == player.Id)
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();
        return matches.Select(ToDto).ToList();
    }

    public async Task<MatchResultDto> CreateForSelfAsync(ClaimsPrincipal user, CreateMatchResultDto dto)
    {
        var player = await _access.RequireOwnPlayerAsync(user);

        // An unplayed fixture has no performance to rate — reject before writing anything.
        if (dto.PersonalRating is not null && dto.Status == MatchStatus.Scheduled)
            throw new ValidationApiException("A scheduled fixture cannot be rated — record the result first.");

        var match = new MatchResult
        {
            PlayerId = player.Id,
            OpponentName = dto.OpponentName.Trim(),
            MatchDate = dto.MatchDate,
            Status = dto.Status,
            HomeScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.HomeScore,
            AwayScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.AwayScore,
            IsHome = dto.IsHome,
            ScoreFormat = MatchResult.FormatForSport(player.SportId),
            SetScores = dto.Status == MatchStatus.Scheduled || string.IsNullOrWhiteSpace(dto.SetScores)
                ? null : dto.SetScores.Trim(),
            Venue = dto.Venue,
            Competition = dto.Competition,
            Notes = dto.Notes,
            OpponentFormation = NormalizeOptional(dto.OpponentFormation),
            ScoutingNotes = NormalizeOptional(dto.ScoutingNotes),
        };
        // Player-context stamping resolves via SeasonRoster only; a solo athlete has no
        // roster rows, so this is NoCoveringSeason (null) today — honest, never blocking.
        var stamp = await _seasons.ForPlayerAsync(player.Id, DateOnly.FromDateTime(dto.MatchDate));
        match.SeasonId = stamp.SeasonId;
        _context.MatchResults.Add(match);
        await _context.SaveChangesAsync();

        // "How did I play?" — stored as the athlete's own rating on their match.
        if (dto.PersonalRating is decimal rating)
        {
            _context.PlayerMatchRatings.Add(new PlayerMatchRating
            {
                MatchResultId = match.Id,
                PlayerId = player.Id,
                Rating = Math.Clamp(rating, 1, 10),
            });
            await _context.SaveChangesAsync();
        }

        var result = ToDto(await LoadMatchAsync(match.Id));
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    // Team matches require team access; personal (solo) matches require player ownership.
    private async Task EnsureCanManageMatchAsync(ClaimsPrincipal user, MatchResult match)
    {
        if (match.PlayerId != null)
            await _access.EnsureCanAccessPlayerAsync(user, match.PlayerId.Value);
        else if (match.TeamId != null)
            await _access.EnsureCanAccessTeamAsync(user, match.TeamId.Value);
        else
            throw new ForbiddenApiException();
    }

    public async Task<MatchResultDto> UpdateAsync(ClaimsPrincipal user, int matchId, CreateMatchResultDto dto)
    {
        var match = await LoadMatchAsync(matchId);
        await EnsureCanManageMatchAsync(user, match);

        // Recorded ratings are evidence the match was played — reverting it to a
        // fixture would orphan them as performances of a match that "never happened".
        if (match.Status == MatchStatus.Played && dto.Status == MatchStatus.Scheduled && match.Ratings.Count > 0)
            throw new ConflictApiException(
                "This match has recorded player ratings — remove them before reverting it to a scheduled fixture.");

        match.OpponentName = dto.OpponentName.Trim();
        match.MatchDate = dto.MatchDate;
        match.Status = dto.Status;
        match.HomeScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.HomeScore;
        match.AwayScore = dto.Status == MatchStatus.Scheduled ? 0 : dto.AwayScore;
        match.IsHome = dto.IsHome;
        // Keep score format aligned with the team's/player's sport (in case older rows predate it).
        match.ScoreFormat = MatchResult.FormatForSport(
            match.Team?.SportId
            ?? await _context.Players.Where(p => p.Id == match.PlayerId).Select(p => p.SportId).FirstOrDefaultAsync());
        match.SetScores = dto.Status == MatchStatus.Scheduled || string.IsNullOrWhiteSpace(dto.SetScores)
            ? null : dto.SetScores.Trim();
        match.Venue = dto.Venue;
        match.Competition = dto.Competition;
        match.Notes = dto.Notes;
        match.OpponentFormation = NormalizeOptional(dto.OpponentFormation);
        match.ScoutingNotes = NormalizeOptional(dto.ScoutingNotes);
        await _context.SaveChangesAsync();
        return ToDto(match);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int matchId)
    {
        var match = await LoadMatchAsync(matchId);
        await EnsureCanManageMatchAsync(user, match);
        _context.MatchResults.Remove(match);
        await _context.SaveChangesAsync();
    }

    public async Task<MatchResultDto> SaveRatingsAsync(ClaimsPrincipal user, int matchId, SaveMatchRatingsDto dto)
    {
        var match = await LoadMatchAsync(matchId);
        await EnsureCanManageMatchAsync(user, match);

        // An unplayed fixture has no performances to rate. This also keeps the
        // evidence auto-import honest for free (it only runs from this path).
        if (match.Status == MatchStatus.Scheduled)
            throw new ValidationApiException("A scheduled fixture cannot be rated — record the result first.");

        // Only players on this match's team (or the solo owner themselves) may be rated.
        var teamPlayerIds = match.PlayerId != null
            ? new List<int> { match.PlayerId.Value }
            : await _context.Players.Where(p => p.TeamId == match.TeamId).Select(p => p.Id).ToListAsync();
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
                StatJson = string.IsNullOrWhiteSpace(r.StatJson) ? null : r.StatJson,
                Goals = r.Goals,
                Assists = r.Assists,
                YellowCards = r.YellowCards,
                RedCards = r.RedCards,
                MinutesPlayed = r.MinutesPlayed,
                Notes = r.Notes,
            });
        }
        await _context.SaveChangesAsync();

        // Evidence layer: mirror these ratings into MatchStatEntry rows so logged match
        // stats feed evidence-based scores with no extra work. Best-effort — a sync
        // failure must never break the ratings save.
        try
        {
            await SyncEvidenceMatchStatsAsync(match, dto);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Evidence match-stat sync failed for match {MatchId}.", matchId);
        }

        var reloaded = await _context.MatchResults
            .Include(m => m.Team)
            .Include(m => m.Ratings).ThenInclude(r => r.Player)
            .FirstAsync(m => m.Id == matchId);
        return ToDto(reloaded);
    }

    // Percentage-type stats where a 0 almost certainly means "not entered" rather than a
    // real measurement (a 0% pass accuracy would poison the evidence average with a 1.0).
    private static readonly HashSet<string> PercentKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "passAccuracy", "fgPercentage", "threePercentage", "ftPercentage",
        "killPercentage", "firstServeIn", "firstServeWon", "secondServeWon",
    };

    // Upserts one auto-imported MatchStatEntry per rated player (keyed by match+player)
    // and removes auto entries for players no longer rated. Manual entries (quick-entry
    // modal) are never touched. Recalculates evidence scores for every affected player.
    private async Task SyncEvidenceMatchStatsAsync(MatchResult match, SaveMatchRatingsDto dto)
    {
        var sportId = match.TeamId != null
            ? await _context.Teams.Where(t => t.Id == match.TeamId).Select(t => t.SportId).FirstAsync()
            : await _context.Players.Where(p => p.Id == match.PlayerId).Select(p => p.SportId).FirstAsync();

        var existingAuto = await _context.MatchStatEntries
            .Where(e => e.MatchResultId == match.Id && e.IsAutoImported)
            .ToListAsync();
        var manualPlayerIds = (await _context.MatchStatEntries
            .Where(e => e.MatchResultId == match.Id && !e.IsAutoImported)
            .Select(e => e.PlayerId)
            .ToListAsync()).ToHashSet();

        var affected = new HashSet<int>();
        var keptPlayerIds = new HashSet<int>();

        foreach (var r in dto.Ratings)
        {
            // A manual entry for this match+player wins — don't clobber the coach's data.
            if (manualPlayerIds.Contains(r.PlayerId)) continue;

            var stats = EvidenceScoringEngine.ParseStatsJson(r.StatJson ?? "{}");
            // Legacy soccer columns still arrive on the DTO for old clients — merge them in.
            if (!stats.ContainsKey("goals") && r.Goals != 0) stats["goals"] = r.Goals;
            if (!stats.ContainsKey("assists") && r.Assists != 0) stats["assists"] = r.Assists;
            if (!stats.ContainsKey("minutesPlayed") && r.MinutesPlayed != 0) stats["minutesPlayed"] = r.MinutesPlayed;

            // Zero percentages are unfilled form fields, not measurements.
            foreach (var key in stats.Keys.Where(k => PercentKeys.Contains(k) && stats[k] == 0).ToList())
                stats.Remove(key);

            // Skip players with no real stats (all zeros besides minutes): the rating form
            // defaults every field to 0, and importing an empty row would poison averages.
            var hasRealStats = stats.Any(kv =>
                kv.Value != 0 && !kv.Key.Equals("minutesPlayed", StringComparison.OrdinalIgnoreCase));
            if (!hasRealStats) continue;

            stats["rating"] = r.Rating; // overall performance, stored for completeness

            keptPlayerIds.Add(r.PlayerId);
            var json = JsonSerializer.Serialize(stats);
            var entry = existingAuto.FirstOrDefault(e => e.PlayerId == r.PlayerId);
            if (entry == null)
            {
                _context.MatchStatEntries.Add(new MatchStatEntry
                {
                    PlayerId = r.PlayerId,
                    MatchResultId = match.Id,
                    StatDate = match.MatchDate,
                    SportId = sportId,
                    StatsJson = json,
                    IsAutoImported = true,
                });
                affected.Add(r.PlayerId);
            }
            else if (entry.StatsJson != json || entry.StatDate != match.MatchDate)
            {
                entry.StatsJson = json;
                entry.StatDate = match.MatchDate;
                affected.Add(r.PlayerId);
            }
        }

        // Ratings are replaced wholesale — auto entries for de-rated players go too.
        foreach (var stale in existingAuto.Where(e => !keptPlayerIds.Contains(e.PlayerId)))
        {
            _context.MatchStatEntries.Remove(stale);
            affected.Add(stale.PlayerId);
        }

        await _context.SaveChangesAsync();

        foreach (var playerId in affected)
            await _evidence.RecalculateAllAsync(playerId);
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
        return ratings.Select(r =>
        {
            var dto = ToRatingDto(r);
            dto.MatchDate = r.MatchResult?.MatchDate;
            dto.OpponentName = r.MatchResult?.OpponentName;
            dto.ScoreFormat = r.MatchResult?.ScoreFormat;
            return dto;
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
        // A Scheduled fixture has no score: every score/outcome field is null —
        // the API must never assert a result that wasn't recorded (a 0-0 future
        // match rendering as a Draw is exactly the fabrication this prevents).
        var isScheduled = m.Status == MatchStatus.Scheduled;
        var ourScore = m.IsHome ? m.HomeScore : m.AwayScore;
        var oppScore = m.IsHome ? m.AwayScore : m.HomeScore;
        var result = ourScore > oppScore ? MatchOutcome.Win : ourScore == oppScore ? MatchOutcome.Draw : MatchOutcome.Loss;
        return new MatchResultDto
        {
            Id = m.Id,
            TeamId = m.TeamId,
            PlayerId = m.PlayerId,
            TeamName = m.Team?.Name ?? "",
            OpponentName = m.OpponentName,
            MatchDate = m.MatchDate,
            Status = m.Status,
            HomeScore = isScheduled ? null : m.HomeScore,
            AwayScore = isScheduled ? null : m.AwayScore,
            IsHome = m.IsHome,
            OurScore = isScheduled ? null : ourScore,
            OpponentScore = isScheduled ? null : oppScore,
            Result = isScheduled ? null : result,
            ScoreFormat = m.ScoreFormat,
            SetScores = isScheduled ? null : m.SetScores,
            ScoreDisplay = isScheduled ? null : $"{ourScore} - {oppScore}",
            Venue = m.Venue,
            Competition = m.Competition,
            Notes = m.Notes,
            OpponentFormation = m.OpponentFormation,
            ScoutingNotes = m.ScoutingNotes,
            Ratings = (m.Ratings ?? new List<PlayerMatchRating>())
                .OrderByDescending(r => r.Rating)
                .Select(ToRatingDto).ToList(),
        };
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static PlayerMatchRatingDto ToRatingDto(PlayerMatchRating r) => new()
    {
        Id = r.Id,
        MatchResultId = r.MatchResultId,
        PlayerId = r.PlayerId,
        PlayerName = r.Player?.FullName ?? "",
        Rating = r.Rating,
        StatJson = r.StatJson,
        Goals = r.Goals,
        Assists = r.Assists,
        YellowCards = r.YellowCards,
        RedCards = r.RedCards,
        MinutesPlayed = r.MinutesPlayed,
        Notes = r.Notes,
    };
}
