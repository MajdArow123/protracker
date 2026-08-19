using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IPlayerService
{
    Task<List<PlayerDto>> GetAccessiblePlayersAsync(ClaimsPrincipal user);
    Task<PlayerProfileDto> GetByIdAsync(ClaimsPrincipal user, int id);
    Task<PlayerProfileDto> GetMyPlayerAsync(ClaimsPrincipal user);
    Task<PlayerProfileDto> CreateAsync(ClaimsPrincipal user, PlayerCreateDto dto);
    Task<PlayerProfileDto> UpdateAsync(ClaimsPrincipal user, int id, PlayerUpdateDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class PlayerService : IPlayerService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IBillingService _billing;
    private readonly IRosterStintRecorder _stints;

    public PlayerService(ApplicationDbContext context, IAccessControlService access, IBillingService billing,
        IRosterStintRecorder stints)
    {
        _stints = stints;
        _context = context;
        _access = access;
        _billing = billing;
    }

    public async Task<List<PlayerDto>> GetAccessiblePlayersAsync(ClaimsPrincipal user)
    {
        // A solo athlete's only accessible player is their own (they have no team).
        if (_access.IsSoloAthlete(user))
        {
            var own = await _context.Players
                .Include(p => p.Team).Include(p => p.Position)
                .Where(p => p.UserId == _access.RequireUserId(user))
                .ToListAsync();
            return own.Select(ToDto).ToList();
        }

        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var players = await _context.Players.Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value))
            .Include(p => p.Team).Include(p => p.Position)
            .ToListAsync();
        return players.Select(ToDto).ToList();
    }

    public async Task<PlayerProfileDto> GetMyPlayerAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var player = await _context.Players
            .Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new NotFoundApiException("No player record is linked to your account.");
        return ToProfileDto(player);
    }

    public async Task<PlayerProfileDto> GetByIdAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsureCanAccessPlayerAsync(user, id);

        var player = await _context.Players.Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Player {id} was not found.");

        return ToProfileDto(player);
    }

    public async Task<PlayerProfileDto> CreateAsync(ClaimsPrincipal user, PlayerCreateDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, dto.TeamId);
        await _access.EnsureTeamPermissionAsync(user, dto.TeamId, p => p.CanManagePlayers,
            "You don't have permission to manage players on this team.");
        await _billing.EnsureCanAddPlayerAsync(user);

        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == dto.TeamId)
            ?? throw new NotFoundApiException($"Team {dto.TeamId} was not found.");

        var position = await _context.Positions.FirstOrDefaultAsync(p => p.Id == dto.PositionId)
            ?? throw new ValidationApiException($"Position {dto.PositionId} does not exist.");

        if (position.SportId != team.SportId)
            throw new ValidationApiException("Position does not belong to the team's sport.");

        var player = new Player
        {
            FullName = dto.FullName,
            Age = dto.Age,
            Height = dto.Height,
            Weight = dto.Weight,
            SportId = team.SportId,
            TeamId = dto.TeamId,
            PositionId = dto.PositionId,
            FitnessLevel = dto.FitnessLevel,
            PreferredFoot = ParseFoot(dto.PreferredFoot),
            SecondaryPositionIds = await ValidateSecondaryPositionsAsync(
                dto.SecondaryPositionIds, team.SportId),
            JerseyNumber = dto.JerseyNumber,
            Status = ParseStatus(dto.Status) ?? PlayerStatus.Active,
            InjuryNotes = dto.InjuryNotes,
            Goals = dto.Goals,
            CoachNotes = dto.CoachNotes,
            ProfileImageUrl = dto.ProfileImageUrl
        };

        _context.Players.Add(player);
        await _context.SaveChangesAsync();

        // §5d Q3: the join is committed; the auto-stint is best-effort metadata on an
        // isolated scope — it can never fail this create. Ambiguity rides back as the
        // existing coach-facing notice.
        var seasonNotice = await _stints.RecordJoinAsync(player.Id, player.TeamId!.Value, dto.LocalDate);

        await _context.Entry(player).Reference(p => p.Team).LoadAsync();
        await _context.Entry(player).Reference(p => p.Position).LoadAsync();
        var result = ToProfileDto(player);
        result.SeasonNotice = seasonNotice;
        return result;
    }

    public async Task<PlayerProfileDto> UpdateAsync(ClaimsPrincipal user, int id, PlayerUpdateDto dto)
    {
        await _access.EnsurePlayerPermissionAsync(user, id, p => p.CanManagePlayers,
            "You don't have permission to manage players on this team.");

        var player = await _context.Players.Include(p => p.Team).Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Player {id} was not found.");

        var position = await _context.Positions.FirstOrDefaultAsync(p => p.Id == dto.PositionId)
            ?? throw new ValidationApiException($"Position {dto.PositionId} does not exist.");

        if (position.SportId != player.SportId)
            throw new ValidationApiException("Position does not belong to the player's sport.");

        player.FullName = dto.FullName;
        player.Age = dto.Age;
        player.Height = dto.Height;
        player.Weight = dto.Weight;
        player.PositionId = dto.PositionId;
        player.FitnessLevel = dto.FitnessLevel;
        player.PreferredFoot = ParseFoot(dto.PreferredFoot);
        player.SecondaryPositionIds = await ValidateSecondaryPositionsAsync(
            dto.SecondaryPositionIds, player.SportId);
        player.JerseyNumber = dto.JerseyNumber;
        if (ParseStatus(dto.Status) is { } status) player.Status = status;
        player.InjuryNotes = dto.InjuryNotes;
        player.Goals = dto.Goals;
        player.CoachNotes = dto.CoachNotes;
        player.ProfileImageUrl = dto.ProfileImageUrl;

        await _context.SaveChangesAsync();
        await _context.Entry(player).Reference(p => p.Position).LoadAsync();
        return ToProfileDto(player);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsurePlayerPermissionAsync(user, id, p => p.CanManagePlayers,
            "You don't have permission to manage players on this team.");

        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Player {id} was not found.");

        _context.Players.Remove(player);
        await _context.SaveChangesAsync();
    }

    public static PlayerDto ToDto(Player p) => new()
    {
        Id = p.Id,
        FullName = p.FullName,
        Age = p.Age,
        Height = p.Height,
        Weight = p.Weight,
        SportId = p.SportId,
        TeamId = p.TeamId,
        TeamName = p.Team?.Name ?? "",
        PositionId = p.PositionId,
        PositionName = p.Position?.Name ?? "",
        FitnessLevel = p.FitnessLevel,
        PreferredFoot = p.PreferredFoot?.ToString(),
        SecondaryPositionIds = ParseSecondaryPositionIds(p.SecondaryPositionIds),
        ProfileImageUrl = p.ProfileImageUrl,
        JerseyNumber = p.JerseyNumber,
        Status = p.Status.ToString(),
        JoinedViaCodeAt = p.JoinedViaCodeAt,
        IsSolo = p.IsSolo
    };

    private static PlayerStatus? ParseStatus(string? status) =>
        !string.IsNullOrWhiteSpace(status) && Enum.TryParse<PlayerStatus>(status, true, out var parsed)
            ? parsed
            : null;

    // Coach-entered; an invalid non-blank value is a 400, never silently dropped
    // (unlike Status's null-means-unchanged contract, this is a full write-through).
    private static PreferredFoot? ParseFoot(string? foot)
    {
        if (string.IsNullOrWhiteSpace(foot)) return null;
        if (Enum.TryParse<PreferredFoot>(foot, true, out var parsed)) return parsed;
        throw new ValidationApiException($"'{foot}' is not a valid preferred foot (Left, Right or Both).");
    }

    public static List<int> ParseSecondaryPositionIds(string? stored) =>
        string.IsNullOrWhiteSpace(stored)
            ? new List<int>()
            : stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var id) ? id : 0)
                .Where(id => id > 0)
                .ToList();

    // Sport membership check (shape rules — ≤3, distinct, ≠ primary — live in the
    // FluentValidation validators). The Positions table is the sport's position
    // config, so a cross-sport or invented id can never be stored.
    private async Task<string?> ValidateSecondaryPositionsAsync(List<int>? ids, int sportId)
    {
        if (ids == null || ids.Count == 0) return null;
        var validCount = await _context.Positions
            .CountAsync(p => ids.Contains(p.Id) && p.SportId == sportId);
        if (validCount != ids.Count)
            throw new ValidationApiException("Every secondary position must belong to the player's sport.");
        return string.Join(',', ids);
    }

    public static PlayerProfileDto ToProfileDto(Player p)
    {
        var dto = ToDto(p);
        return new PlayerProfileDto
        {
            Id = dto.Id,
            FullName = dto.FullName,
            Age = dto.Age,
            Height = dto.Height,
            Weight = dto.Weight,
            SportId = dto.SportId,
            TeamId = dto.TeamId,
            TeamName = dto.TeamName,
            PositionId = dto.PositionId,
            PositionName = dto.PositionName,
            FitnessLevel = dto.FitnessLevel,
            PreferredFoot = dto.PreferredFoot,
            SecondaryPositionIds = dto.SecondaryPositionIds,
            ProfileImageUrl = dto.ProfileImageUrl,
            JerseyNumber = dto.JerseyNumber,
            Status = dto.Status,
            JoinedViaCodeAt = dto.JoinedViaCodeAt,
            IsSolo = dto.IsSolo,
            InjuryNotes = p.InjuryNotes,
            Goals = p.Goals,
            CoachNotes = p.CoachNotes,
            UserId = p.UserId
        };
    }
}
