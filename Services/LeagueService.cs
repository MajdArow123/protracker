using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ILeagueService
{
    Task<List<LeagueSummaryDto>> ListAsync(ClaimsPrincipal user, int? sport, LeagueStatus? status, LeagueType? type, string? search);
    Task<List<LeagueSummaryDto>> ListMineAsync(ClaimsPrincipal user);
    Task<LeagueDetailDto> GetDetailAsync(ClaimsPrincipal user, int id);
    Task<LeagueDetailDto> CreateAsync(ClaimsPrincipal user, CreateLeagueDto dto);
    Task<LeagueDetailDto> UpdateAsync(ClaimsPrincipal user, int id, UpdateLeagueDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);

    Task<LeagueTeamDto> RegisterTeamAsync(ClaimsPrincipal user, int leagueId, int teamId);
    Task<LeagueTeamDto> SetTeamStatusAsync(ClaimsPrincipal user, int leagueId, int leagueTeamId, LeagueTeamStatus status);

    Task<List<LeagueMatchDto>> GetMatchesAsync(ClaimsPrincipal user, int leagueId);
    Task<LeagueMatchDto> CreateMatchAsync(ClaimsPrincipal user, int leagueId, CreateLeagueMatchDto dto);
    Task<LeagueMatchDto> UpdateMatchScoreAsync(ClaimsPrincipal user, int matchId, UpdateLeagueMatchScoreDto dto);
    Task DeleteMatchAsync(ClaimsPrincipal user, int matchId);
    Task<int> GenerateScheduleAsync(ClaimsPrincipal user, int leagueId);

    Task<List<LeagueStandingDto>> GetStandingsAsync(ClaimsPrincipal user, int leagueId);
}

public class LeagueService : ILeagueService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public LeagueService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    // ─── Leagues ────────────────────────────────────────────────────────────────

    public async Task<List<LeagueSummaryDto>> ListAsync(ClaimsPrincipal user, int? sport, LeagueStatus? status, LeagueType? type, string? search)
    {
        var q = _context.Leagues.Include(l => l.Sport).Where(l => l.IsPublic);
        if (sport is int sp) q = q.Where(l => l.SportId == sp);
        if (status is LeagueStatus st) q = q.Where(l => l.Status == st);
        if (type is LeagueType ty) q = q.Where(l => l.Type == ty);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(l => l.Name.ToLower().Contains(s) || (l.Location != null && l.Location.ToLower().Contains(s)));
        }

        var leagues = await q.OrderByDescending(l => l.CreatedAt).ToListAsync();
        return await ToSummariesAsync(user, leagues);
    }

    public async Task<List<LeagueSummaryDto>> ListMineAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);

        var leagues = await _context.Leagues.Include(l => l.Sport)
            .Where(l => l.OrganizerId == userId
                || l.Teams.Any(t => teamIds.Contains(t.TeamId) && t.Status != LeagueTeamStatus.Rejected))
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
        return await ToSummariesAsync(user, leagues);
    }

    public async Task<LeagueDetailDto> GetDetailAsync(ClaimsPrincipal user, int id)
    {
        var league = await _context.Leagues.Include(l => l.Sport)
            .FirstOrDefaultAsync(l => l.Id == id)
            ?? throw new NotFoundApiException($"League {id} was not found.");

        var userId = _access.RequireUserId(user);
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var isOrganizer = league.OrganizerId == userId || user.IsInRole("Admin");

        // Private leagues are only visible to the organizer or a registered team's coach/athlete.
        if (!league.IsPublic && !isOrganizer)
        {
            var involved = await _context.LeagueTeams.AnyAsync(t => t.LeagueId == id && teamIds.Contains(t.TeamId));
            if (!involved) throw new NotFoundApiException($"League {id} was not found.");
        }

        var teams = await _context.LeagueTeams.Include(t => t.Team)
            .Where(t => t.LeagueId == id)
            .OrderBy(t => t.JoinedAt)
            .ToListAsync();
        var coachNames = await ResolveNamesAsync(teams.Select(t => t.CoachId).Append(league.OrganizerId));

        var standings = await LoadStandingDtosAsync(id, teamIds);

        var dto = new LeagueDetailDto();
        FillSummary(dto, league, coachNames.GetValueOrDefault(league.OrganizerId, "Coach"),
            teams.Count(t => t.Status == LeagueTeamStatus.Approved), isOrganizer,
            teams.Any(t => teamIds.Contains(t.TeamId) && t.Status != LeagueTeamStatus.Rejected));
        dto.Rules = league.Rules;
        dto.PrizeDescription = league.PrizeDescription;
        dto.PointsWin = league.PointsWin;
        dto.PointsDraw = league.PointsDraw;
        dto.PointsLoss = league.PointsLoss;
        dto.ScoreFormat = MatchResult.FormatForSport(league.SportId).ToString();
        dto.Teams = teams.Select(t => new LeagueTeamDto
        {
            Id = t.Id,
            TeamId = t.TeamId,
            TeamName = t.Team.Name,
            TeamPhotoUrl = t.Team.PhotoUrl,
            CoachId = t.CoachId,
            CoachName = coachNames.GetValueOrDefault(t.CoachId, "Coach"),
            Status = t.Status,
            JoinedAt = t.JoinedAt,
            IsMine = teamIds.Contains(t.TeamId),
        }).ToList();
        dto.Standings = standings;
        return dto;
    }

    public async Task<LeagueDetailDto> CreateAsync(ClaimsPrincipal user, CreateLeagueDto dto)
    {
        var userId = _access.RequireUserId(user);
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ValidationApiException("League name is required.");
        if (!await _context.Sports.AnyAsync(s => s.Id == dto.SportId))
            throw new ValidationApiException("The selected sport does not exist.");

        var league = new League
        {
            Name = dto.Name.Trim(),
            Description = Clean(dto.Description),
            SportId = dto.SportId,
            OrganizerId = userId,
            Type = dto.Type,
            Format = dto.Format,
            Status = LeagueStatus.Draft,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            MaxTeams = dto.MaxTeams,
            IsPublic = dto.IsPublic,
            Location = Clean(dto.Location),
            Rules = Clean(dto.Rules),
            PrizeDescription = Clean(dto.PrizeDescription),
            PointsWin = dto.PointsWin ?? 3,
            PointsDraw = dto.PointsDraw ?? 1,
            PointsLoss = dto.PointsLoss ?? 0,
            CreatedAt = DateTime.UtcNow,
        };
        _context.Leagues.Add(league);
        await _context.SaveChangesAsync();
        return await GetDetailAsync(user, league.Id);
    }

    public async Task<LeagueDetailDto> UpdateAsync(ClaimsPrincipal user, int id, UpdateLeagueDto dto)
    {
        var league = await RequireOrganizedLeagueAsync(user, id);
        league.Name = string.IsNullOrWhiteSpace(dto.Name) ? league.Name : dto.Name.Trim();
        league.Description = Clean(dto.Description);
        league.Type = dto.Type;
        league.Format = dto.Format;
        league.Status = dto.Status;
        league.StartDate = dto.StartDate;
        league.EndDate = dto.EndDate;
        league.MaxTeams = dto.MaxTeams;
        league.IsPublic = dto.IsPublic;
        league.Location = Clean(dto.Location);
        league.Rules = Clean(dto.Rules);
        league.PrizeDescription = Clean(dto.PrizeDescription);
        if (dto.PointsWin is int pw) league.PointsWin = pw;
        if (dto.PointsDraw is int pd) league.PointsDraw = pd;
        if (dto.PointsLoss is int pl) league.PointsLoss = pl;
        // Sport is intentionally immutable once teams may be registered.
        await _context.SaveChangesAsync();
        await RecalculateStandingsAsync(id); // points may have changed
        return await GetDetailAsync(user, id);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var league = await RequireOrganizedLeagueAsync(user, id);
        _context.Leagues.Remove(league);
        await _context.SaveChangesAsync();
    }

    // ─── Team registration ────────────────────────────────────────────────────

    public async Task<LeagueTeamDto> RegisterTeamAsync(ClaimsPrincipal user, int leagueId, int teamId)
    {
        var league = await _context.Leagues.FirstOrDefaultAsync(l => l.Id == leagueId)
            ?? throw new NotFoundApiException($"League {leagueId} was not found.");

        // Coach must have access to the team they're registering.
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var team = await _context.Teams.FirstAsync(t => t.Id == teamId);
        if (team.SportId != league.SportId)
            throw new ValidationApiException("The team's sport does not match this league.");

        if (await _context.LeagueTeams.AnyAsync(t => t.LeagueId == leagueId && t.TeamId == teamId && t.Status != LeagueTeamStatus.Rejected))
            throw new ValidationApiException("This team is already registered in the league.");

        if (league.MaxTeams is int max)
        {
            var approved = await _context.LeagueTeams.CountAsync(t => t.LeagueId == leagueId && t.Status == LeagueTeamStatus.Approved);
            if (approved >= max) throw new ValidationApiException("This league is full.");
        }

        var entry = new LeagueTeam
        {
            LeagueId = leagueId,
            TeamId = teamId,
            CoachId = _access.RequireUserId(user),
            JoinedAt = DateTime.UtcNow,
            // The organizer auto-approves their own team; others start Pending.
            Status = league.OrganizerId == _access.RequireUserId(user) ? LeagueTeamStatus.Approved : LeagueTeamStatus.Pending,
        };
        _context.LeagueTeams.Add(entry);
        await _context.SaveChangesAsync();
        if (entry.Status == LeagueTeamStatus.Approved) await RecalculateStandingsAsync(leagueId);

        return new LeagueTeamDto
        {
            Id = entry.Id, TeamId = teamId, TeamName = team.Name, TeamPhotoUrl = team.PhotoUrl,
            CoachId = entry.CoachId, Status = entry.Status, JoinedAt = entry.JoinedAt, IsMine = true,
        };
    }

    public async Task<LeagueTeamDto> SetTeamStatusAsync(ClaimsPrincipal user, int leagueId, int leagueTeamId, LeagueTeamStatus status)
    {
        await RequireOrganizedLeagueAsync(user, leagueId);
        var entry = await _context.LeagueTeams.Include(t => t.Team)
            .FirstOrDefaultAsync(t => t.Id == leagueTeamId && t.LeagueId == leagueId)
            ?? throw new NotFoundApiException("Team registration not found.");
        entry.Status = status;
        await _context.SaveChangesAsync();
        await RecalculateStandingsAsync(leagueId);

        var coachName = (await ResolveNamesAsync(new[] { entry.CoachId })).GetValueOrDefault(entry.CoachId, "Coach");
        return new LeagueTeamDto
        {
            Id = entry.Id, TeamId = entry.TeamId, TeamName = entry.Team.Name, TeamPhotoUrl = entry.Team.PhotoUrl,
            CoachId = entry.CoachId, CoachName = coachName, Status = entry.Status, JoinedAt = entry.JoinedAt,
        };
    }

    // ─── Matches ────────────────────────────────────────────────────────────────

    public async Task<List<LeagueMatchDto>> GetMatchesAsync(ClaimsPrincipal user, int leagueId)
    {
        await GetDetailAsync(user, leagueId); // visibility check
        var matches = await _context.LeagueMatches
            .Include(m => m.HomeTeam).ThenInclude(t => t.Team)
            .Include(m => m.AwayTeam).ThenInclude(t => t.Team)
            .Where(m => m.LeagueId == leagueId)
            .OrderBy(m => m.Round).ThenBy(m => m.ScheduledAt).ThenBy(m => m.Id)
            .ToListAsync();
        return matches.Select(ToMatchDto).ToList();
    }

    public async Task<LeagueMatchDto> CreateMatchAsync(ClaimsPrincipal user, int leagueId, CreateLeagueMatchDto dto)
    {
        await RequireOrganizedLeagueAsync(user, leagueId);
        if (dto.HomeTeamId == dto.AwayTeamId)
            throw new ValidationApiException("A team can't play itself.");
        var valid = await _context.LeagueTeams
            .Where(t => t.LeagueId == leagueId && t.Status == LeagueTeamStatus.Approved)
            .Select(t => t.Id).ToListAsync();
        if (!valid.Contains(dto.HomeTeamId) || !valid.Contains(dto.AwayTeamId))
            throw new ValidationApiException("Both teams must be approved members of the league.");

        var match = new LeagueMatch
        {
            LeagueId = leagueId,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            ScheduledAt = dto.ScheduledAt,
            Round = dto.Round,
            Group = Clean(dto.Group),
            Venue = Clean(dto.Venue),
            Notes = Clean(dto.Notes),
            Status = LeagueMatchStatus.Scheduled,
        };
        _context.LeagueMatches.Add(match);
        await _context.SaveChangesAsync();
        return await LoadMatchDtoAsync(match.Id);
    }

    public async Task<LeagueMatchDto> UpdateMatchScoreAsync(ClaimsPrincipal user, int matchId, UpdateLeagueMatchScoreDto dto)
    {
        var match = await _context.LeagueMatches.FirstOrDefaultAsync(m => m.Id == matchId)
            ?? throw new NotFoundApiException("Match not found.");
        await RequireOrganizedLeagueAsync(user, match.LeagueId);
        if (dto.HomeScore < 0 || dto.AwayScore < 0)
            throw new ValidationApiException("Scores can't be negative.");

        match.HomeScore = dto.HomeScore;
        match.AwayScore = dto.AwayScore;
        match.SetScores = Clean(dto.SetScores);
        match.Status = dto.Status;
        await _context.SaveChangesAsync();
        await RecalculateStandingsAsync(match.LeagueId);
        return await LoadMatchDtoAsync(matchId);
    }

    public async Task DeleteMatchAsync(ClaimsPrincipal user, int matchId)
    {
        var match = await _context.LeagueMatches.FirstOrDefaultAsync(m => m.Id == matchId)
            ?? throw new NotFoundApiException("Match not found.");
        await RequireOrganizedLeagueAsync(user, match.LeagueId);
        var leagueId = match.LeagueId;
        _context.LeagueMatches.Remove(match);
        await _context.SaveChangesAsync();
        await RecalculateStandingsAsync(leagueId);
    }

    public async Task<int> GenerateScheduleAsync(ClaimsPrincipal user, int leagueId)
    {
        var league = await RequireOrganizedLeagueAsync(user, leagueId);
        var existing = await _context.LeagueMatches.Where(m => m.LeagueId == leagueId).ToListAsync();
        if (existing.Any(m => m.Status == LeagueMatchStatus.Completed))
            throw new ValidationApiException("Can't regenerate — some matches already have results. Delete them first.");
        _context.LeagueMatches.RemoveRange(existing);

        var teams = await _context.LeagueTeams
            .Where(t => t.LeagueId == leagueId && t.Status == LeagueTeamStatus.Approved)
            .OrderBy(t => t.JoinedAt).Select(t => t.Id).ToListAsync();
        if (teams.Count < 2) throw new ValidationApiException("Need at least 2 approved teams to generate a schedule.");

        var matches = league.Format == LeagueFormat.Knockout
            ? GenerateKnockout(leagueId, teams)
            : GenerateRoundRobin(leagueId, teams);

        _context.LeagueMatches.AddRange(matches);
        await _context.SaveChangesAsync();
        await RecalculateStandingsAsync(leagueId);
        return matches.Count;
    }

    public async Task<List<LeagueStandingDto>> GetStandingsAsync(ClaimsPrincipal user, int leagueId)
    {
        await GetDetailAsync(user, leagueId); // visibility check
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        return await LoadStandingDtosAsync(leagueId, teamIds);
    }

    // ─── Standings recalculation ────────────────────────────────────────────────

    private async Task RecalculateStandingsAsync(int leagueId)
    {
        var league = await _context.Leagues.FirstAsync(l => l.Id == leagueId);
        var approved = await _context.LeagueTeams
            .Where(t => t.LeagueId == leagueId && t.Status == LeagueTeamStatus.Approved)
            .Select(t => t.Id).ToListAsync();

        var matches = await _context.LeagueMatches
            .Where(m => m.LeagueId == leagueId && m.Status == LeagueMatchStatus.Completed
                        && m.HomeScore != null && m.AwayScore != null)
            .OrderBy(m => m.ScheduledAt).ThenBy(m => m.Id)
            .ToListAsync();

        // Build per-team stats.
        var stats = approved.ToDictionary(id => id, _ => new StandingAccumulator());
        foreach (var m in matches)
        {
            if (!stats.ContainsKey(m.HomeTeamId) || !stats.ContainsKey(m.AwayTeamId)) continue;
            var hs = m.HomeScore!.Value; var as_ = m.AwayScore!.Value;
            Apply(stats[m.HomeTeamId], hs, as_, league);
            Apply(stats[m.AwayTeamId], as_, hs, league);
        }

        // Upsert standings; drop rows for teams no longer approved.
        var existing = await _context.LeagueStandings.Where(s => s.LeagueId == leagueId).ToListAsync();
        _context.LeagueStandings.RemoveRange(existing.Where(s => !approved.Contains(s.LeagueTeamId)));

        var rows = new List<LeagueStanding>();
        foreach (var ltId in approved)
        {
            var acc = stats[ltId];
            var row = existing.FirstOrDefault(s => s.LeagueTeamId == ltId);
            if (row == null)
            {
                row = new LeagueStanding { LeagueId = leagueId, LeagueTeamId = ltId };
                _context.LeagueStandings.Add(row);
            }
            row.Played = acc.Played; row.Won = acc.Won; row.Drawn = acc.Drawn; row.Lost = acc.Lost;
            row.GoalsFor = acc.GoalsFor; row.GoalsAgainst = acc.GoalsAgainst;
            row.Points = acc.Won * league.PointsWin + acc.Drawn * league.PointsDraw + acc.Lost * league.PointsLoss;
            row.Form = acc.Form.Count == 0 ? null : string.Concat(acc.Form.TakeLast(5));
            rows.Add(row);
        }

        // Rank: points → goal difference → goals for.
        var ranked = rows
            .OrderByDescending(r => r.Points)
            .ThenByDescending(r => r.GoalsFor - r.GoalsAgainst)
            .ThenByDescending(r => r.GoalsFor)
            .ToList();
        for (var i = 0; i < ranked.Count; i++) ranked[i].Position = i + 1;

        await _context.SaveChangesAsync();
    }

    private static void Apply(StandingAccumulator acc, int forScore, int againstScore, League league)
    {
        acc.Played++;
        acc.GoalsFor += forScore;
        acc.GoalsAgainst += againstScore;
        if (forScore > againstScore) { acc.Won++; acc.Form.Add('W'); }
        else if (forScore == againstScore) { acc.Drawn++; acc.Form.Add('D'); }
        else { acc.Lost++; acc.Form.Add('L'); }
    }

    private class StandingAccumulator
    {
        public int Played, Won, Drawn, Lost, GoalsFor, GoalsAgainst;
        public List<char> Form { get; } = new();
    }

    // ─── Schedule generators ─────────────────────────────────────────────────────

    // Single round-robin via the circle method (each team plays every other once).
    private static List<LeagueMatch> GenerateRoundRobin(int leagueId, List<int> teamIds)
    {
        var teams = new List<int?>(teamIds.Cast<int?>());
        if (teams.Count % 2 != 0) teams.Add(null); // bye
        int n = teams.Count, rounds = n - 1, half = n / 2;
        var result = new List<LeagueMatch>();
        var arr = teams.ToList();
        for (var r = 0; r < rounds; r++)
        {
            for (var i = 0; i < half; i++)
            {
                var home = arr[i]; var away = arr[n - 1 - i];
                if (home != null && away != null)
                {
                    // Alternate home/away by round for fairness.
                    var (h, a) = r % 2 == 0 ? (home.Value, away.Value) : (away.Value, home.Value);
                    result.Add(new LeagueMatch { LeagueId = leagueId, HomeTeamId = h, AwayTeamId = a, Round = r + 1, Status = LeagueMatchStatus.Scheduled });
                }
            }
            // Rotate: keep first fixed, rotate the rest clockwise.
            var last = arr[n - 1];
            arr.RemoveAt(n - 1);
            arr.Insert(1, last);
        }
        return result;
    }

    // First-round knockout bracket (pairs seeded teams; a bye if odd).
    private static List<LeagueMatch> GenerateKnockout(int leagueId, List<int> teamIds)
    {
        var result = new List<LeagueMatch>();
        for (var i = 0; i + 1 < teamIds.Count; i += 2)
            result.Add(new LeagueMatch { LeagueId = leagueId, HomeTeamId = teamIds[i], AwayTeamId = teamIds[i + 1], Round = 1, Status = LeagueMatchStatus.Scheduled });
        return result;
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    private async Task<League> RequireOrganizedLeagueAsync(ClaimsPrincipal user, int leagueId)
    {
        var league = await _context.Leagues.FirstOrDefaultAsync(l => l.Id == leagueId)
            ?? throw new NotFoundApiException($"League {leagueId} was not found.");
        var userId = _access.RequireUserId(user);
        if (league.OrganizerId != userId && !user.IsInRole("Admin"))
            throw new ForbiddenApiException("Only the league organizer can do that.");
        return league;
    }

    private async Task<List<LeagueSummaryDto>> ToSummariesAsync(ClaimsPrincipal user, List<League> leagues)
    {
        var userId = _access.RequireUserId(user);
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var ids = leagues.Select(l => l.Id).ToList();

        var approvedCounts = await _context.LeagueTeams
            .Where(t => ids.Contains(t.LeagueId) && t.Status == LeagueTeamStatus.Approved)
            .GroupBy(t => t.LeagueId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        var myRegistrations = await _context.LeagueTeams
            .Where(t => ids.Contains(t.LeagueId) && teamIds.Contains(t.TeamId) && t.Status != LeagueTeamStatus.Rejected)
            .Select(t => t.LeagueId).Distinct().ToListAsync();
        var organizerNames = await ResolveNamesAsync(leagues.Select(l => l.OrganizerId));

        return leagues.Select(l =>
        {
            var dto = new LeagueSummaryDto();
            FillSummary(dto, l, organizerNames.GetValueOrDefault(l.OrganizerId, "Coach"),
                approvedCounts.GetValueOrDefault(l.Id, 0), l.OrganizerId == userId || user.IsInRole("Admin"),
                myRegistrations.Contains(l.Id));
            return dto;
        }).ToList();
    }

    private static void FillSummary(LeagueSummaryDto dto, League l, string organizerName, int teamCount, bool isOrganizer, bool isRegistered)
    {
        dto.Id = l.Id;
        dto.Name = l.Name;
        dto.Description = l.Description;
        dto.SportId = l.SportId;
        dto.SportName = l.Sport?.Name ?? "";
        dto.OrganizerId = l.OrganizerId;
        dto.OrganizerName = organizerName;
        dto.Type = l.Type;
        dto.Format = l.Format;
        dto.Status = l.Status;
        dto.StartDate = l.StartDate;
        dto.EndDate = l.EndDate;
        dto.MaxTeams = l.MaxTeams;
        dto.TeamCount = teamCount;
        dto.IsPublic = l.IsPublic;
        dto.Location = l.Location;
        dto.IsOrganizer = isOrganizer;
        dto.IsRegistered = isRegistered;
    }

    private async Task<List<LeagueStandingDto>> LoadStandingDtosAsync(int leagueId, List<int> callerTeamIds)
    {
        var standings = await _context.LeagueStandings
            .Include(s => s.LeagueTeam).ThenInclude(t => t.Team)
            .Where(s => s.LeagueId == leagueId)
            .OrderBy(s => s.Position)
            .ToListAsync();
        return standings.Select(s => new LeagueStandingDto
        {
            LeagueTeamId = s.LeagueTeamId,
            TeamId = s.LeagueTeam.TeamId,
            TeamName = s.LeagueTeam.Team.Name,
            TeamPhotoUrl = s.LeagueTeam.Team.PhotoUrl,
            Position = s.Position,
            Played = s.Played, Won = s.Won, Drawn = s.Drawn, Lost = s.Lost,
            GoalsFor = s.GoalsFor, GoalsAgainst = s.GoalsAgainst,
            Points = s.Points, Form = s.Form,
            IsMine = callerTeamIds.Contains(s.LeagueTeam.TeamId),
        }).ToList();
    }

    private async Task<LeagueMatchDto> LoadMatchDtoAsync(int matchId)
    {
        var match = await _context.LeagueMatches
            .Include(m => m.HomeTeam).ThenInclude(t => t.Team)
            .Include(m => m.AwayTeam).ThenInclude(t => t.Team)
            .FirstAsync(m => m.Id == matchId);
        return ToMatchDto(match);
    }

    private static LeagueMatchDto ToMatchDto(LeagueMatch m) => new()
    {
        Id = m.Id,
        LeagueId = m.LeagueId,
        HomeTeamId = m.HomeTeamId,
        AwayTeamId = m.AwayTeamId,
        HomeTeamName = m.HomeTeam?.Team?.Name ?? "",
        AwayTeamName = m.AwayTeam?.Team?.Name ?? "",
        HomeTeamPhotoUrl = m.HomeTeam?.Team?.PhotoUrl,
        AwayTeamPhotoUrl = m.AwayTeam?.Team?.PhotoUrl,
        ScheduledAt = m.ScheduledAt,
        HomeScore = m.HomeScore,
        AwayScore = m.AwayScore,
        SetScores = m.SetScores,
        Status = m.Status,
        Round = m.Round,
        Group = m.Group,
        Venue = m.Venue,
        Notes = m.Notes,
    };

    private async Task<Dictionary<string, string>> ResolveNamesAsync(IEnumerable<string> userIds)
    {
        var ids = userIds.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
        if (ids.Count == 0) return new();
        return await _context.Users.Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
