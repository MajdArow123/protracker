using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ILineupService
{
    Task<LineupDto?> GetAsync(ClaimsPrincipal user, int teamId, int? matchResultId, string? name);
    Task<List<LineupSummaryDto>> ListAsync(ClaimsPrincipal user, int teamId);
    Task<LineupDto> UpsertAsync(ClaimsPrincipal user, int teamId, SaveLineupDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int teamId, int? matchResultId, string? name);
    Task<LineupDto> PublishAsync(ClaimsPrincipal user, int lineupId);
    Task<LineupDto> UnpublishAsync(ClaimsPrincipal user, int lineupId);
    Task<PagedResult<LineupAuditEntryDto>> GetAuditAsync(ClaimsPrincipal user, int teamId, int? lineupId, int page);
}

// Saved lineups: team default XI, named team lineups, or per-match. Uniqueness
// per key — (TeamId, MatchResultId) for match lineups, (TeamId, normalized Name)
// for team lineups — is enforced here: the upsert runs in a transaction and is
// the only write path (codebase convention: invariants live in the service
// layer, no filtered index). Phase 6 adds the optimistic version check
// (BaseVersion must match, backed by the EF concurrency token), the published
// lock (edit/delete 409 until unpublish), and the transactional change audit.
public class LineupService : ILineupService
{
    private const int MaxNamedLineupsPerTeam = 10;
    private const int AuditPageSize = 20;

    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public LineupService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<LineupDto?> GetAsync(ClaimsPrincipal user, int teamId, int? matchResultId, string? name)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var key = NormalizeKey(matchResultId, name);
        var lineup = await QueryByKey(teamId, key.MatchResultId, key.Name)
            .Include(l => l.Slots)
            .Include(l => l.SetPieces)
            .FirstOrDefaultAsync();
        return lineup == null ? null : ToDto(lineup, await DisplayNameAsync(lineup.UpdatedByUserId));
    }

    public async Task<List<LineupSummaryDto>> ListAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var rows = await _context.Lineups
            .Where(l => l.TeamId == teamId)
            .Select(l => new
            {
                l.Id, l.MatchResultId, l.Name, l.Formation, l.Status, l.PublishedAt,
                l.Version, l.UpdatedAt, l.UpdatedByUserId, SlotCount = l.Slots.Count,
            })
            .ToListAsync();

        var userIds = rows.Select(r => r.UpdatedByUserId).Where(id => id != null).Distinct().ToList();
        var names = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName);

        // Default XI first, then named team lineups A→Z, then match lineups newest-first.
        return rows
            .OrderBy(r => r.MatchResultId != null ? 2 : r.Name != null ? 1 : 0)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ThenByDescending(r => r.UpdatedAt)
            .Select(r => new LineupSummaryDto
            {
                Id = r.Id,
                MatchResultId = r.MatchResultId,
                Name = r.Name,
                Formation = r.Formation,
                Status = r.Status.ToString(),
                PublishedAt = r.PublishedAt,
                Version = r.Version,
                SlotCount = r.SlotCount,
                UpdatedAt = r.UpdatedAt,
                UpdatedByName = r.UpdatedByUserId != null && names.TryGetValue(r.UpdatedByUserId, out var n) ? n : null,
            })
            .ToList();
    }

    public async Task<LineupDto> UpsertAsync(ClaimsPrincipal user, int teamId, SaveLineupDto dto)
    {
        await _access.EnsureTeamPermissionAsync(user, teamId, p => p.CanManageTeam,
            "You do not have permission to manage this team's lineup.");
        var key = NormalizeKey(dto.MatchResultId, dto.Name);

        if (key.MatchResultId is int matchId)
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

        var userId = _access.RequireUserId(user);
        var changedByName = await DisplayNameAsync(userId) ?? "Unknown";

        await using var tx = await _context.Database.BeginTransactionAsync();

        // Deterministic pick (oldest row) + self-heal if a duplicate ever slipped through.
        var existing = await QueryByKey(teamId, key.MatchResultId, key.Name)
            .Include(l => l.Slots)
            .Include(l => l.SetPieces)
            .OrderBy(l => l.Id)
            .ToListAsync();
        var lineup = existing.FirstOrDefault();
        if (existing.Count > 1) _context.Lineups.RemoveRange(existing.Skip(1));

        LineupSnapshot? before = null;
        var created = lineup == null;
        if (lineup == null)
        {
            // A BaseVersion claims "I'm updating an existing row" — if that row
            // is gone, the honest answer is a conflict, not a silent re-create.
            if (dto.BaseVersion != null)
                throw new ConflictApiException("This lineup no longer exists — it was removed elsewhere. Reload before saving again.");
            if (key.Name != null)
            {
                var namedCount = await _context.Lineups
                    .CountAsync(l => l.TeamId == teamId && l.MatchResultId == null && l.Name != null);
                if (namedCount >= MaxNamedLineupsPerTeam)
                    throw new ValidationApiException($"A team can have at most {MaxNamedLineupsPerTeam} named lineups.");
            }
            lineup = new Lineup { TeamId = teamId, MatchResultId = key.MatchResultId };
            _context.Lineups.Add(lineup);
        }
        else
        {
            // Published = locked; the version check is strict — a missing
            // BaseVersion on an existing row is a conflict, never a clobber.
            if (lineup.Status == LineupStatus.Published)
                throw new ConflictApiException("This lineup is published — unpublish it to make changes.");
            if (dto.BaseVersion != lineup.Version)
                throw new ConflictApiException("This lineup was changed elsewhere — reload to get the latest version.");
            before = Snapshot(lineup);
            lineup.Version += 1;
        }

        lineup.Name = key.Name; // create sets it; update may only retouch casing (key is case-insensitive)
        lineup.Formation = dto.Formation;
        lineup.UpdatedAt = DateTime.UtcNow;
        lineup.UpdatedByUserId = userId;
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

        await SaveGuardingVersionAsync();

        // Audit in the same transaction — part of the change, not best-effort.
        var after = Snapshot(lineup);
        var summary = created
            ? LineupDiffSummarizer.SummarizeCreated(after)
            : LineupDiffSummarizer.SummarizeSave(before!, after, await PlayerNamesAsync(before!, after));
        if (summary.Length > 0)
        {
            _context.LineupChangeAudits.Add(new LineupChangeAudit
            {
                TeamId = teamId,
                LineupId = lineup.Id,
                KeyLabel = await BuildKeyLabelAsync(key.MatchResultId, key.Name),
                ChangedByUserId = userId,
                ChangedByName = changedByName,
                Action = created ? "created" : "saved",
                Version = lineup.Version,
                Summary = summary,
            });
            await _context.SaveChangesAsync();
        }

        await tx.CommitAsync();
        return ToDto(lineup, changedByName);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int teamId, int? matchResultId, string? name)
    {
        await _access.EnsureTeamPermissionAsync(user, teamId, p => p.CanManageTeam,
            "You do not have permission to manage this team's lineup.");
        var key = NormalizeKey(matchResultId, name);

        var rows = await QueryByKey(teamId, key.MatchResultId, key.Name).ToListAsync();
        if (rows.Count == 0) return; // resetting an unsaved lineup is a no-op, not an error
        if (rows.Any(l => l.Status == LineupStatus.Published))
            throw new ConflictApiException("This lineup is published — unpublish it before removing it.");

        var userId = _access.RequireUserId(user);
        _context.Lineups.RemoveRange(rows);
        // LineupId stays null: the row it referenced is going in this same
        // SaveChanges; KeyLabel keeps the entry readable.
        _context.LineupChangeAudits.Add(new LineupChangeAudit
        {
            TeamId = teamId,
            LineupId = null,
            KeyLabel = await BuildKeyLabelAsync(key.MatchResultId, key.Name),
            ChangedByUserId = userId,
            ChangedByName = await DisplayNameAsync(userId) ?? "Unknown",
            Action = "deleted",
            Version = 0,
            Summary = "Lineup removed",
        });
        await _context.SaveChangesAsync();
    }

    public Task<LineupDto> PublishAsync(ClaimsPrincipal user, int lineupId) =>
        SetStatusAsync(user, lineupId, publish: true);

    public Task<LineupDto> UnpublishAsync(ClaimsPrincipal user, int lineupId) =>
        SetStatusAsync(user, lineupId, publish: false);

    private async Task<LineupDto> SetStatusAsync(ClaimsPrincipal user, int lineupId, bool publish)
    {
        var lineup = await _context.Lineups
            .Include(l => l.Slots)
            .Include(l => l.SetPieces)
            .FirstOrDefaultAsync(l => l.Id == lineupId);
        if (lineup == null) throw new NotFoundApiException("Lineup not found.");

        await _access.EnsureTeamPermissionAsync(user, lineup.TeamId, p => p.CanPublishLineup,
            "You do not have permission to publish this team's lineups.");

        if (publish && lineup.Status == LineupStatus.Published)
            throw new ValidationApiException("This lineup is already published.");
        if (!publish && lineup.Status != LineupStatus.Published)
            throw new ValidationApiException("This lineup is not published.");

        var userId = _access.RequireUserId(user);
        var changedByName = await DisplayNameAsync(userId) ?? "Unknown";

        lineup.Status = publish ? LineupStatus.Published : LineupStatus.Draft;
        lineup.PublishedAt = publish ? DateTime.UtcNow : null;
        lineup.Version += 1;
        lineup.UpdatedAt = DateTime.UtcNow;
        lineup.UpdatedByUserId = userId;

        _context.LineupChangeAudits.Add(new LineupChangeAudit
        {
            TeamId = lineup.TeamId,
            LineupId = lineup.Id,
            KeyLabel = await BuildKeyLabelAsync(lineup.MatchResultId, lineup.Name),
            ChangedByUserId = userId,
            ChangedByName = changedByName,
            Action = publish ? "published" : "unpublished",
            Version = lineup.Version,
            Summary = publish ? "Published" : "Unpublished",
        });
        await SaveGuardingVersionAsync();
        return ToDto(lineup, changedByName);
    }

    public async Task<PagedResult<LineupAuditEntryDto>> GetAuditAsync(ClaimsPrincipal user, int teamId, int? lineupId, int page)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        if (page < 1) page = 1;

        var query = _context.LineupChangeAudits
            .Where(a => a.TeamId == teamId && (lineupId == null || a.LineupId == lineupId));
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id)
            .Skip((page - 1) * AuditPageSize)
            .Take(AuditPageSize)
            .Select(a => new LineupAuditEntryDto
            {
                Id = a.Id,
                LineupId = a.LineupId,
                KeyLabel = a.KeyLabel,
                ChangedByName = a.ChangedByName,
                Action = a.Action,
                Version = a.Version,
                Summary = a.Summary,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync();

        return new PagedResult<LineupAuditEntryDto>
        {
            Items = items,
            Page = page,
            PageSize = AuditPageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)AuditPageSize),
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static (int? MatchResultId, string? Name) NormalizeKey(int? matchResultId, string? name)
    {
        var normalized = NullIfBlank(name);
        if (matchResultId != null && normalized != null)
            throw new ValidationApiException("A match lineup cannot also have a name.");
        return (matchResultId, normalized);
    }

    private IQueryable<Lineup> QueryByKey(int teamId, int? matchResultId, string? name)
    {
        var query = _context.Lineups.Where(l => l.TeamId == teamId);
        if (matchResultId != null)
        {
            query = query.Where(l => l.MatchResultId == matchResultId);
        }
        else if (name == null)
        {
            query = query.Where(l => l.MatchResultId == null && l.Name == null);
        }
        else
        {
            var lower = name.ToLowerInvariant();
            query = query.Where(l => l.MatchResultId == null && l.Name != null && l.Name.ToLower() == lower);
        }
        return query.OrderBy(l => l.Id); // deterministic even if a duplicate ever exists
    }

    // The concurrency token turns a true write race (both editors passed the
    // explicit check) into the same 409 the stale-version path produces.
    private async Task SaveGuardingVersionAsync()
    {
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictApiException("This lineup was changed elsewhere — reload to get the latest version.");
        }
    }

    private static LineupSnapshot Snapshot(Lineup l) => new(
        l.Formation,
        l.Slots.ToDictionary(s => s.SlotKey, s => s.PlayerId),
        l.CaptainPlayerId,
        l.ViceCaptainPlayerId,
        LineupDiffSummarizer.BuildTacticalSignature(
            l.Notes,
            string.IsNullOrWhiteSpace(l.TacticalLabels)
                ? Enumerable.Empty<string>()
                : l.TacticalLabels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            l.Slots.Select(s => new KeyValuePair<string, string?>(s.SlotKey, s.Role)),
            l.SetPieces.Select(s => new KeyValuePair<string, int>(s.Type, s.PlayerId))));

    private async Task<Dictionary<int, string>> PlayerNamesAsync(LineupSnapshot before, LineupSnapshot after)
    {
        var ids = before.SlotPlayers.Values
            .Concat(after.SlotPlayers.Values)
            .Concat(new[] { before.CaptainPlayerId, after.CaptainPlayerId, before.ViceCaptainPlayerId, after.ViceCaptainPlayerId }
                .Where(id => id != null).Select(id => id!.Value))
            .Distinct()
            .ToList();
        return await _context.Players
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.FullName })
            .ToDictionaryAsync(p => p.Id, p => p.FullName);
    }

    private async Task<string> BuildKeyLabelAsync(int? matchResultId, string? name)
    {
        string label;
        if (name != null)
        {
            label = name;
        }
        else if (matchResultId is int matchId)
        {
            var match = await _context.MatchResults
                .Where(m => m.Id == matchId)
                .Select(m => new { m.OpponentName, m.MatchDate })
                .FirstOrDefaultAsync();
            label = match == null
                ? $"Match {matchId}"
                : $"vs {match.OpponentName} ({match.MatchDate:yyyy-MM-dd})";
        }
        else
        {
            label = "Default XI";
        }
        return label.Length <= 80 ? label : label[..79] + "…";
    }

    private async Task<string?> DisplayNameAsync(string? userId) =>
        userId == null
            ? null
            : await _context.Users.Where(u => u.Id == userId).Select(u => u.DisplayName).FirstOrDefaultAsync();

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static LineupDto ToDto(Lineup l, string? updatedByName) => new()
    {
        Id = l.Id,
        TeamId = l.TeamId,
        MatchResultId = l.MatchResultId,
        Name = l.Name,
        Formation = l.Formation,
        Status = l.Status.ToString(),
        PublishedAt = l.PublishedAt,
        Version = l.Version,
        UpdatedAt = l.UpdatedAt,
        UpdatedByName = updatedByName,
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
