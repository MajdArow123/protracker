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
    Task<PlayerProfileDto> CreateAsync(ClaimsPrincipal user, PlayerCreateDto dto);
    Task<PlayerProfileDto> UpdateAsync(ClaimsPrincipal user, int id, PlayerUpdateDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class PlayerService : IPlayerService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public PlayerService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<PlayerDto>> GetAccessiblePlayersAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var players = await _context.Players.Where(p => teamIds.Contains(p.TeamId))
            .Include(p => p.Team).Include(p => p.Position)
            .ToListAsync();
        return players.Select(ToDto).ToList();
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
            InjuryNotes = dto.InjuryNotes,
            Goals = dto.Goals,
            CoachNotes = dto.CoachNotes,
            ProfileImageUrl = dto.ProfileImageUrl
        };

        _context.Players.Add(player);
        await _context.SaveChangesAsync();

        await _context.Entry(player).Reference(p => p.Team).LoadAsync();
        await _context.Entry(player).Reference(p => p.Position).LoadAsync();
        return ToProfileDto(player);
    }

    public async Task<PlayerProfileDto> UpdateAsync(ClaimsPrincipal user, int id, PlayerUpdateDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, id);

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
        await _access.EnsureCanAccessPlayerAsync(user, id);

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
        ProfileImageUrl = p.ProfileImageUrl
    };

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
            ProfileImageUrl = dto.ProfileImageUrl,
            InjuryNotes = p.InjuryNotes,
            Goals = p.Goals,
            CoachNotes = p.CoachNotes,
            UserId = p.UserId
        };
    }
}
