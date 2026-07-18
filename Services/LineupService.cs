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
            .Include(l => l.SetPieces)
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

        // Tactical layer: captaincy and set-piece takers are eligible-from-XI
        // only (the slot set is the XI; team ownership is transitive from the
        // check above). Re-runs on every save, so a player who left the roster
        // can never be re-persisted (the frontend drops them roster-keyed).
        var xi = playerIds.ToHashSet();
        if (dto.CaptainPlayerId is int captainId && !xi.Contains(captainId))
            throw new ValidationApiException("The captain must be one of the lineup's players.");
        if (dto.ViceCaptainPlayerId is int viceId && !xi.Contains(viceId))
            throw new ValidationApiException("The vice-captain must be one of the lineup's players.");
        if (dto.CaptainPlayerId != null && dto.CaptainPlayerId == dto.ViceCaptainPlayerId)
            throw new ValidationApiException("The captain and vice-captain must be different players.");
        var setPieces = dto.SetPieces ?? new List<SetPieceAssignmentDto>();
        foreach (var sp in setPieces)
        {
            if (!xi.Contains(sp.PlayerId))
                throw new ValidationApiException($"The set-piece taker for '{sp.Type}' must be one of the lineup's players.");
        }

        await using var tx = await _context.Database.BeginTransactionAsync();

        // Deterministic pick (oldest row) + self-heal if a duplicate ever slipped through.
        var existing = await QueryByKey(teamId, dto.MatchResultId)
            .Include(l => l.Slots)
            .Include(l => l.SetPieces)
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
        lineup.CaptainPlayerId = dto.CaptainPlayerId;
        lineup.ViceCaptainPlayerId = dto.ViceCaptainPlayerId;
        lineup.Notes = NullIfBlank(dto.Notes);
        lineup.TacticalLabels = dto.TacticalLabels is { Count: > 0 } labels
            ? string.Join(',', labels.Select(l => l.Trim()))
            : null;
        lineup.Slots.Clear();
        lineup.Slots.AddRange(dto.Slots.Select(s => new LineupSlot
        {
            SlotKey = s.SlotKey,
            PlayerId = s.PlayerId,
            Role = NullIfBlank(s.Role),
            Instructions = NullIfBlank(s.Instructions),
        }));
        lineup.SetPieces.Clear();
        lineup.SetPieces.AddRange(setPieces.Select(sp => new SetPieceAssignment
        {
            Type = sp.Type.Trim(),
            PlayerId = sp.PlayerId,
        }));

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

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static LineupDto ToDto(Lineup l) => new()
    {
        Id = l.Id,
        TeamId = l.TeamId,
        MatchResultId = l.MatchResultId,
        Formation = l.Formation,
        UpdatedAt = l.UpdatedAt,
        CaptainPlayerId = l.CaptainPlayerId,
        ViceCaptainPlayerId = l.ViceCaptainPlayerId,
        Notes = l.Notes,
        TacticalLabels = string.IsNullOrWhiteSpace(l.TacticalLabels)
            ? new List<string>()
            : l.TacticalLabels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
        Slots = l.Slots
            .OrderBy(s => s.SlotKey, StringComparer.Ordinal)
            .Select(s => new LineupSlotDto
            {
                SlotKey = s.SlotKey,
                PlayerId = s.PlayerId,
                Role = s.Role,
                Instructions = s.Instructions,
            })
            .ToList(),
        SetPieces = l.SetPieces
            .OrderBy(a => a.Type, StringComparer.Ordinal)
            .Select(a => new SetPieceAssignmentDto { Type = a.Type, PlayerId = a.PlayerId })
            .ToList(),
    };
}
