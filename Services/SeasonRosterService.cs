using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// Phase 10 S6: the SeasonRoster write path — the first (and only) producer of the rows
// ResolveForPlayerAsync reads. Rulings enforced here, not in the database:
// - At most ONE stint per (player, season) covering any given date. Sequential
//   non-overlapping stints are legal (mid-season transfers, leave-and-rejoin); overlap
//   is a 400 naming the conflicting stint's team and dates. Range overlap can't be a
//   unique index, so the service owns it — alongside JoinedAt <= LeftAt, which nothing
//   else validates either.
// - JoinedAt is required (an undated stint resolves nothing and silently does nothing).
// - The stint's team must PARTICIPATE in the season (SeasonTeam row): the resolver
//   ignores stint TeamId, so without this guard a roster row on a non-participating
//   team would still resolve — data the domain says cannot exist.
// - Saving a stint NEVER retroactively stamps existing records (invisible mutation);
//   instead the save response carries how many unstamped records fall inside the
//   stint's effective window, and the UI points at S7 backfill tooling.
// - Write permission scopes to the STINT's team (CanManagePlayers), never to
//   Player.TeamId — the player may have moved on; the stint remains this team's record.
public interface ISeasonRosterService
{
    Task<List<SeasonRosterStintDto>> GetForSeasonAsync(ClaimsPrincipal user, int seasonId);
    Task<SeasonRosterSaveResultDto> CreateAsync(ClaimsPrincipal user, int seasonId, SaveSeasonRosterStintDto dto);
    Task<SeasonRosterSaveResultDto> UpdateAsync(ClaimsPrincipal user, int stintId, SaveSeasonRosterStintDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int stintId);
}

public class SeasonRosterService : ISeasonRosterService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public SeasonRosterService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<SeasonRosterStintDto>> GetForSeasonAsync(ClaimsPrincipal user, int seasonId)
    {
        // Uniform season 404 (S4 contract): nonexistent and inaccessible are the same answer.
        await _access.EnsureCanAccessSeasonAsync(user, seasonId);
        return await _context.SeasonRosters
            .Where(r => r.SeasonId == seasonId)
            .OrderBy(r => r.Team.Name).ThenBy(r => r.Player.FullName).ThenBy(r => r.JoinedAt)
            .Select(r => new SeasonRosterStintDto
            {
                Id = r.Id,
                SeasonId = r.SeasonId,
                TeamId = r.TeamId,
                TeamName = r.Team.Name,
                PlayerId = r.PlayerId,
                PlayerName = r.Player.FullName,
                JerseyNumber = r.JerseyNumber,
                PositionId = r.PositionId,
                PositionName = r.Position != null ? r.Position.Name : null,
                JoinedAt = r.JoinedAt,
                LeftAt = r.LeftAt,
            })
            .ToListAsync();
    }

    public async Task<SeasonRosterSaveResultDto> CreateAsync(ClaimsPrincipal user, int seasonId, SaveSeasonRosterStintDto dto)
    {
        await _access.EnsureCanAccessSeasonAsync(user, seasonId);
        var season = await _context.Seasons
            .Include(s => s.SeasonTeams)
            .FirstAsync(s => s.Id == seasonId);

        // Participation guard BEFORE the permission check: it only reveals facts about
        // a season the caller can already read, and "that team isn't in this season" is
        // the actionable answer even for a caller who could never write.
        if (!season.SeasonTeams.Any(st => st.TeamId == dto.TeamId))
            throw new BadRequestApiException("That team does not participate in this season, so players cannot be rostered into it here.");

        await _access.EnsureTeamPermissionAsync(user, dto.TeamId, p => p.CanManagePlayers,
            "You do not have permission to manage players on this team.");
        // The player must be visible to the caller today (their team, or their own solo
        // player for admins). Departed players are out of reach until S7 backfill.
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        var joined = RequireJoined(dto);
        ValidateDates(joined, dto.LeftAt);
        await ValidatePositionAsync(dto);
        await EnsureNoOverlapAsync(dto.PlayerId, seasonId, joined, dto.LeftAt, excludeStintId: null);

        var stint = new SeasonRoster
        {
            PlayerId = dto.PlayerId,
            SeasonId = seasonId,
            TeamId = dto.TeamId,
            JoinedAt = joined,
            LeftAt = dto.LeftAt,
            JerseyNumber = dto.JerseyNumber,
            PositionId = dto.PositionId,
        };
        _context.SeasonRosters.Add(stint);
        await _context.SaveChangesAsync();

        return await BuildSaveResultAsync(stint.Id, season);
    }

    public async Task<SeasonRosterSaveResultDto> UpdateAsync(ClaimsPrincipal user, int stintId, SaveSeasonRosterStintDto dto)
    {
        var stint = await LoadStintAsync(stintId);
        await EnsureStintWritePermissionAsync(user, stint);

        // Identity is immutable — a different player/team is a delete + re-add, never a
        // silent rewrite (and never a silent ignore, per the ParseStatus rule).
        if (dto.PlayerId != stint.PlayerId || dto.TeamId != stint.TeamId)
            throw new BadRequestApiException("A stint's player and team cannot be changed — delete the stint and add a new one instead.");

        var joined = RequireJoined(dto);
        ValidateDates(joined, dto.LeftAt);
        await ValidatePositionAsync(dto);
        await EnsureNoOverlapAsync(stint.PlayerId, stint.SeasonId, joined, dto.LeftAt, excludeStintId: stint.Id);

        stint.JoinedAt = joined;
        stint.LeftAt = dto.LeftAt;
        stint.JerseyNumber = dto.JerseyNumber;
        stint.PositionId = dto.PositionId;
        await _context.SaveChangesAsync();

        var season = await _context.Seasons.FirstAsync(s => s.Id == stint.SeasonId);
        return await BuildSaveResultAsync(stint.Id, season);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int stintId)
    {
        var stint = await LoadStintAsync(stintId);
        await EnsureStintWritePermissionAsync(user, stint);
        _context.SeasonRosters.Remove(stint);
        await _context.SaveChangesAsync();
    }

    // --- helpers ---

    private async Task<SeasonRoster> LoadStintAsync(int stintId) =>
        await _context.SeasonRosters.FirstOrDefaultAsync(r => r.Id == stintId)
        ?? throw new NotFoundApiException($"Roster stint {stintId} was not found.");

    // §5g: permission scopes to the STINT's team — never Player.TeamId. A coach who is
    // not on the stint's team at all gets the same 404 as a missing stint (no stint-id
    // enumeration); a coach ON the team without CanManagePlayers gets an honest 403.
    private async Task EnsureStintWritePermissionAsync(ClaimsPrincipal user, SeasonRoster stint)
    {
        CoachPermissions perms;
        bool isHead;
        try
        {
            (perms, isHead) = await _access.GetTeamPermissionsAsync(user, stint.TeamId);
        }
        catch (ForbiddenApiException)
        {
            throw new NotFoundApiException($"Roster stint {stint.Id} was not found.");
        }
        if (isHead || user.IsInRole("Admin") || perms.CanManagePlayers) return;
        throw new ForbiddenApiException("You do not have permission to manage players on this team.");
    }

    private static DateTime RequireJoined(SaveSeasonRosterStintDto dto) =>
        dto.JoinedAt
        ?? throw new BadRequestApiException("A join date is required — an undated stint can never assign records to the season.");

    private static void ValidateDates(DateTime joined, DateTime? left)
    {
        // Day-granular like the resolver: same-day join and leave is a legal one-day stint.
        if (left != null && left.Value.Date < joined.Date)
            throw new BadRequestApiException("The leave date must be on or after the join date.");
    }

    private async Task ValidatePositionAsync(SaveSeasonRosterStintDto dto)
    {
        if (dto.JerseyNumber is < 0 or > 999)
            throw new BadRequestApiException("Jersey number must be between 0 and 999.");
        if (dto.PositionId == null) return;
        var team = await _context.Teams.FirstAsync(t => t.Id == dto.TeamId);
        var valid = await _context.Positions.AnyAsync(p => p.Id == dto.PositionId && p.SportId == team.SportId);
        if (!valid)
            throw new BadRequestApiException("That position does not belong to this team's sport.");
    }

    // Ruling 1: range overlap within ONE season, day-granular (a leave day and a join
    // day both count wholly, so leaving and joining on the same day is an overlap).
    // Overlapping stints across DIFFERENT seasons stay legal — that's the documented
    // Ambiguous case, not a conflict.
    private async Task EnsureNoOverlapAsync(int playerId, int seasonId, DateTime joined, DateTime? left, int? excludeStintId)
    {
        var existing = await _context.SeasonRosters
            .Where(r => r.PlayerId == playerId && r.SeasonId == seasonId
                && (excludeStintId == null || r.Id != excludeStintId))
            .Select(r => new { r.JoinedAt, r.LeftAt, TeamName = r.Team.Name })
            .ToListAsync();

        var newStart = joined.Date;
        var newEnd = left?.Date;
        foreach (var other in existing)
        {
            var otherStart = other.JoinedAt.Date;
            var otherEnd = other.LeftAt?.Date;
            var overlaps = (newEnd == null || otherStart <= newEnd.Value)
                && (otherEnd == null || newStart <= otherEnd.Value);
            if (!overlaps) continue;
            var range = $"{otherStart:yyyy-MM-dd} – {(otherEnd != null ? otherEnd.Value.ToString("yyyy-MM-dd") : "present")}";
            throw new BadRequestApiException(
                $"These dates overlap an existing stint on {other.TeamName} ({range}). A player can only be on one roster at a time within a season — adjust the dates or end the other stint first.");
        }
    }

    private async Task<SeasonRosterSaveResultDto> BuildSaveResultAsync(int stintId, Season season)
    {
        var stintDto = (await GetStintDtoAsync(stintId))!;

        // Ruling 3: the count of this player's UNSTAMPED records inside the stint's
        // effective window — the stint dates clamped to the season window, matching
        // what the resolver would actually cover (and therefore what S7 backfill would
        // assign). EvidenceBasedScores are deliberately excluded: their SeasonId
        // records WHEN a score was computed, not backfillable history.
        var (windowStart, windowEnd) = EffectiveWindow(stintDto.JoinedAt, stintDto.LeftAt, season);
        var count = 0;
        if (windowStart < windowEnd)
        {
            var playerId = stintDto.PlayerId;
            count += await _context.PlayerAssessments.CountAsync(a =>
                a.PlayerId == playerId && a.SeasonId == null && a.DateRecorded >= windowStart && a.DateRecorded < windowEnd);
            count += await _context.ObjectiveTestResults.CountAsync(t =>
                t.PlayerId == playerId && t.SeasonId == null && t.TestedAt >= windowStart && t.TestedAt < windowEnd);
            count += await _context.MatchPerformances.CountAsync(m =>
                m.PlayerId == playerId && m.SeasonId == null && m.MatchDate >= windowStart && m.MatchDate < windowEnd);
            count += await _context.ImprovementPlans.CountAsync(p =>
                p.PlayerId == playerId && p.SeasonId == null && p.CreatedDate >= windowStart && p.CreatedDate < windowEnd);
            // Player-scoped (solo-era) matches only — team matches are team-stamped.
            count += await _context.MatchResults.CountAsync(m =>
                m.PlayerId == playerId && m.SeasonId == null && m.MatchDate >= windowStart && m.MatchDate < windowEnd);
        }

        return new SeasonRosterSaveResultDto { Stint = stintDto, UnstampedInWindow = count };
    }

    private async Task<SeasonRosterStintDto?> GetStintDtoAsync(int stintId) =>
        await _context.SeasonRosters
            .Where(r => r.Id == stintId)
            .Select(r => new SeasonRosterStintDto
            {
                Id = r.Id,
                SeasonId = r.SeasonId,
                TeamId = r.TeamId,
                TeamName = r.Team.Name,
                PlayerId = r.PlayerId,
                PlayerName = r.Player.FullName,
                JerseyNumber = r.JerseyNumber,
                PositionId = r.PositionId,
                PositionName = r.Position != null ? r.Position.Name : null,
                JoinedAt = r.JoinedAt,
                LeftAt = r.LeftAt,
            })
            .FirstOrDefaultAsync();

    // Day-granular half-open [start, end): stint dates intersected with the season
    // window, Kind=Utc for the timestamptz parameters (resolver DayWindow pattern).
    private static (DateTime Start, DateTime End) EffectiveWindow(DateTime joined, DateTime? left, Season season)
    {
        var startDay = DateOnly.FromDateTime(joined.Date > season.StartDate.Date ? joined.Date : season.StartDate.Date);
        var lastDayValue = left?.Date ?? season.EndDate.Date;
        var lastDay = DateOnly.FromDateTime(lastDayValue < season.EndDate.Date ? lastDayValue : season.EndDate.Date);
        var start = startDay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = lastDay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(1);
        return (start, end);
    }
}
