using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ILineupService
{
    Task<LineupDto?> GetAsync(ClaimsPrincipal user, int teamId, int? matchResultId);
    Task<LineupDto> UpsertAsync(ClaimsPrincipal user, int teamId, SaveLineupDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int teamId, int? matchResultId);
}

// Saved lineups (team default XI or per-match). Uniqueness per (TeamId, MatchResultId)
// is enforced here — the upsert runs in a transaction and is the only write path
// (codebase convention: invariants live in the service layer, no filtered index).
public class LineupService : ILineupService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public LineupService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<LineupDto?> GetAsync(ClaimsPrincipal user, int teamId, int? matchResultId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var lineup = await QueryByKey(teamId, matchResultId)
            .Include(l => l.Slots)
            .FirstOrDefaultAsync();
        return lineup == null ? null : ToDto(lineup);
    }

    public async Task<LineupDto> UpsertAsync(ClaimsPrincipal user, int teamId, SaveLineupDto dto)
    {
        await _access.EnsureTeamPermissionAsync(user, teamId, p => p.CanManageTeam,
            "You do not have permission to manage this team's lineup.");

        if (dto.MatchResultId is int matchId)
        {
            var matchOk = await _context.MatchResults.AnyAsync(m => m.Id == matchId && m.TeamId == teamId);
            if (!matchOk) throw new ValidationApiException("The match does not belong to this team.");
        }

        var playerIds = dto.Slots.Select(s => s.PlayerId).ToList();
        if (playerIds.Count > 0)
        {
            var ownedCount = await _context.Players
                .CountAsync(p => playerIds.Contains(p.Id) && p.TeamId == teamId);
            if (ownedCount != playerIds.Count)
                throw new ValidationApiException("Every player in the lineup must belong to this team.");
        }

        await using var tx = await _context.Database.BeginTransactionAsync();

        // Deterministic pick (oldest row) + self-heal if a duplicate ever slipped through.
        var existing = await QueryByKey(teamId, dto.MatchResultId)
            .Include(l => l.Slots)
            .OrderBy(l => l.Id)
            .ToListAsync();
        var lineup = existing.FirstOrDefault();
        if (existing.Count > 1) _context.Lineups.RemoveRange(existing.Skip(1));

        if (lineup == null)
        {
            lineup = new Lineup { TeamId = teamId, MatchResultId = dto.MatchResultId };
            _context.Lineups.Add(lineup);
        }

        lineup.Formation = dto.Formation;
        lineup.UpdatedAt = DateTime.UtcNow;
        lineup.UpdatedByUserId = _access.RequireUserId(user);
        lineup.Slots.Clear();
        lineup.Slots.AddRange(dto.Slots.Select(s => new LineupSlot { SlotKey = s.SlotKey, PlayerId = s.PlayerId }));

        await _context.SaveChangesAsync();
        await tx.CommitAsync();
        return ToDto(lineup);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int teamId, int? matchResultId)
    {
        await _access.EnsureTeamPermissionAsync(user, teamId, p => p.CanManageTeam,
            "You do not have permission to manage this team's lineup.");

        var rows = await QueryByKey(teamId, matchResultId).ToListAsync();
        if (rows.Count == 0) return; // resetting an unsaved lineup is a no-op, not an error
        _context.Lineups.RemoveRange(rows);
        await _context.SaveChangesAsync();
    }

    private IQueryable<Lineup> QueryByKey(int teamId, int? matchResultId) =>
        _context.Lineups
            .Where(l => l.TeamId == teamId && l.MatchResultId == matchResultId)
            .OrderBy(l => l.Id); // deterministic even if a duplicate ever exists

    private static LineupDto ToDto(Lineup l) => new()
    {
        Id = l.Id,
        TeamId = l.TeamId,
        MatchResultId = l.MatchResultId,
        Formation = l.Formation,
        UpdatedAt = l.UpdatedAt,
        Slots = l.Slots
            .OrderBy(s => s.SlotKey, StringComparer.Ordinal)
            .Select(s => new LineupSlotDto { SlotKey = s.SlotKey, PlayerId = s.PlayerId })
            .ToList(),
    };
}
