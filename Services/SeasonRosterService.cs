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
    // §5d Q1: the bulk historical-confirmation flow (owner-only — deliberately gated
    // tighter than the single-stint path above, per the CanPublishLineup precedent).
    Task<List<RosterCandidateDto>> GetConfirmCandidatesAsync(ClaimsPrincipal user, int seasonId);
    Task<ConfirmRosterResultDto> ConfirmHistoricalAsync(ClaimsPrincipal user, int seasonId, ConfirmRosterRequestDto dto);
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

    // --- §5d Q1: historical confirmation ---

    public async Task<List<RosterCandidateDto>> GetConfirmCandidatesAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await RequireOwnedSeasonAsync(user, seasonId);
        var teamIds = season.SeasonTeams.Select(st => st.TeamId).ToList();

        // Candidate listing via Player.TeamId is PERMITTED here (pinned Q1 note): this
        // lists members for a human to assert about — it is not resolution.
        var covered = await _context.SeasonRosters
            .Where(r => r.SeasonId == seasonId)
            .Select(r => r.PlayerId)
            .Distinct()
            .ToListAsync();
        var candidates = await _context.Players
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value) && !covered.Contains(p.Id))
            .OrderBy(p => p.FullName)
            .Select(p => new RosterCandidateDto
            {
                PlayerId = p.Id,
                PlayerName = p.FullName,
                TeamId = p.TeamId!.Value,
                TeamName = p.Team!.Name,
                JerseyNumber = p.JerseyNumber,
                PositionName = p.Position != null ? p.Position.Name : null,
            })
            .ToListAsync();

        // Earliest recorded activity — a labeled hint, never a prefill (Q1). Cheap:
        // one grouped min per player-context table.
        var ids = candidates.Select(c => c.PlayerId).ToList();
        var mins = new List<Dictionary<int, DateTime>>
        {
            await _context.PlayerAssessments.Where(a => ids.Contains(a.PlayerId))
                .GroupBy(a => a.PlayerId).Select(g => new { g.Key, Min = g.Min(a => a.DateRecorded) })
                .ToDictionaryAsync(x => x.Key, x => x.Min),
            await _context.ObjectiveTestResults.Where(t => ids.Contains(t.PlayerId))
                .GroupBy(t => t.PlayerId).Select(g => new { g.Key, Min = g.Min(t => t.TestedAt) })
                .ToDictionaryAsync(x => x.Key, x => x.Min),
            await _context.MatchPerformances.Where(m => ids.Contains(m.PlayerId))
                .GroupBy(m => m.PlayerId).Select(g => new { g.Key, Min = g.Min(m => m.MatchDate) })
                .ToDictionaryAsync(x => x.Key, x => x.Min),
        };
        foreach (var c in candidates)
        {
            var dates = mins.Where(m => m.ContainsKey(c.PlayerId)).Select(m => m[c.PlayerId]).ToList();
            c.EarliestActivity = dates.Count > 0 ? dates.Min() : null;
        }
        return candidates;
    }

    public async Task<ConfirmRosterResultDto> ConfirmHistoricalAsync(
        ClaimsPrincipal user, int seasonId, ConfirmRosterRequestDto dto)
    {
        var season = await RequireOwnedSeasonAsync(user, seasonId);
        var teamIds = season.SeasonTeams.Select(st => st.TeamId).ToList();

        var entries = dto.Entries.GroupBy(e => e.PlayerId).Select(g => g.First()).ToList();
        if (entries.Count == 0)
            throw new BadRequestApiException("Select at least one player to confirm.");

        var playerIds = entries.Select(e => e.PlayerId).ToList();
        var players = await _context.Players
            .Where(p => playerIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);
        var covered = await _context.SeasonRosters
            .Where(r => r.SeasonId == seasonId && playerIds.Contains(r.PlayerId))
            .Select(r => r.PlayerId)
            .Distinct()
            .ToListAsync();

        // All-or-nothing (bulk-assessment precedent): a bad entry 400s the whole batch,
        // naming the offender; already-covered entries are skips, not failures.
        var result = new ConfirmRosterResultDto();
        await using var tx = await _context.Database.BeginTransactionAsync();
        foreach (var entry in entries)
        {
            if (!players.TryGetValue(entry.PlayerId, out var player)
                || player.TeamId == null || !teamIds.Contains(player.TeamId.Value))
                throw new BadRequestApiException(
                    $"Player {entry.PlayerId} is not a current member of a team participating in this season.");
            if (covered.Contains(entry.PlayerId))
            {
                result.SkippedAlreadyCovered++;
                continue;
            }
            if (entry.JoinedAt == null)
                throw new BadRequestApiException(
                    $"A join date is required for {player.FullName} — the coach's assertion is what makes the stint honest.");

            var joined = DateTime.SpecifyKind(entry.JoinedAt.Value.Date, DateTimeKind.Utc);
            _context.SeasonRosters.Add(new SeasonRoster
            {
                PlayerId = player.Id,
                SeasonId = seasonId,
                TeamId = player.TeamId.Value,
                JoinedAt = joined,
                LeftAt = null,
                JerseyNumber = player.JerseyNumber,
                PositionId = player.PositionId,
                Source = StintSource.CoachConfirmed,
            });
            result.CreatedCount++;
            result.UnstampedInWindow += await CountUnstampedInWindowAsync(player.Id, joined, null, season);
        }
        await _context.SaveChangesAsync();
        await tx.CommitAsync();
        return result;
    }

    // §5d owner gate: nonexistent and not-owned are the SAME 404 (no id enumeration —
    // the S7 backfill contract, deliberately NOT SeasonService.EnsureOwner's 403:
    // assistants can read participating seasons, but the bulk flow shouldn't confirm
    // their existence as confirmable).
    private async Task<Season> RequireOwnedSeasonAsync(ClaimsPrincipal user, int seasonId)
    {
        var season = await _context.Seasons
            .Include(s => s.SeasonTeams)
            .FirstOrDefaultAsync(s => s.Id == seasonId)
            ?? throw new NotFoundApiException($"Season {seasonId} was not found.");
        if (!user.IsInRole("Admin") && season.OwnerId != _access.RequireUserId(user))
            throw new NotFoundApiException($"Season {seasonId} was not found.");
        return season;
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

        var count = await CountUnstampedInWindowAsync(stintDto.PlayerId, stintDto.JoinedAt, stintDto.LeftAt, season);
        return new SeasonRosterSaveResultDto { Stint = stintDto, UnstampedInWindow = count };
    }

    // Ruling 3: the count of this player's UNSTAMPED records inside the stint's
    // effective window — the stint dates clamped to the season window, matching
    // what the resolver would actually cover (and therefore what S7 backfill would
    // assign). EvidenceBasedScores are deliberately excluded: their SeasonId
    // records WHEN a score was computed, not backfillable history.
    private async Task<int> CountUnstampedInWindowAsync(int playerId, DateTime joined, DateTime? left, Season season)
    {
        var (windowStart, windowEnd) = EffectiveWindow(joined, left, season);
        if (windowStart >= windowEnd) return 0;

        var count = 0;
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
        return count;
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
