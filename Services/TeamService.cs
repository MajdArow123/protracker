using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITeamService
{
    Task<List<TeamDto>> GetAccessibleTeamsAsync(ClaimsPrincipal user);
    Task<TeamWithPlayersDto> GetByIdAsync(ClaimsPrincipal user, int id);
    Task<TeamDto> CreateAsync(ClaimsPrincipal user, TeamCreateDto dto);
    Task<TeamDto> UpdateAsync(ClaimsPrincipal user, int id, TeamUpdateDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<List<PlayerDto>> GetPlayersAsync(ClaimsPrincipal user, int id);
}

public class TeamService : ITeamService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public TeamService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<TeamDto>> GetAccessibleTeamsAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var teams = await _context.Teams.Where(t => teamIds.Contains(t.Id))
            .Include(t => t.Sport)
            .Include(t => t.Players)
            .ToListAsync();
        return teams.Select(ToDto).ToList();
    }

    public async Task<TeamWithPlayersDto> GetByIdAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);

        var team = await _context.Teams
            .Include(t => t.Sport)
            .Include(t => t.Players).ThenInclude(p => p.Position)
            .FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Team {id} was not found.");

        var dto = ToDto(team);
        return new TeamWithPlayersDto
        {
            Id = dto.Id,
            Name = dto.Name,
            SportId = dto.SportId,
            SportName = dto.SportName,
            CoachId = dto.CoachId,
            PlayerCount = dto.PlayerCount,
            Players = team.Players.Select(PlayerService.ToDto).ToList()
        };
    }

    public async Task<TeamDto> CreateAsync(ClaimsPrincipal user, TeamCreateDto dto)
    {
        var coachId = _access.RequireUserId(user);

        if (!await _context.Sports.AnyAsync(s => s.Id == dto.SportId))
            throw new ValidationApiException($"Sport {dto.SportId} does not exist.");

        var team = new Team { Name = dto.Name, SportId = dto.SportId, CoachId = coachId };
        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        _context.CoachTeamScopes.Add(new CoachTeamScope { CoachId = coachId, TeamId = team.Id });
        await _context.SaveChangesAsync();

        await _context.Entry(team).Reference(t => t.Sport).LoadAsync();
        return ToDto(team);
    }

    public async Task<TeamDto> UpdateAsync(ClaimsPrincipal user, int id, TeamUpdateDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);

        var team = await _context.Teams.Include(t => t.Sport).FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Team {id} was not found.");

        team.Name = dto.Name;
        await _context.SaveChangesAsync();
        return ToDto(team);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);

        var team = await _context.Teams.Include(t => t.Players).FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Team {id} was not found.");

        if (team.Players.Any())
            throw new ValidationApiException("Cannot delete a team that still has players assigned. Reassign or remove players first.");

        _context.Teams.Remove(team);
        await _context.SaveChangesAsync();
    }

    public async Task<List<PlayerDto>> GetPlayersAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);

        var players = await _context.Players.Where(p => p.TeamId == id)
            .Include(p => p.Position).Include(p => p.Team)
            .ToListAsync();
        return players.Select(PlayerService.ToDto).ToList();
    }

    private static TeamDto ToDto(Team t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        SportId = t.SportId,
        SportName = t.Sport?.Name ?? "",
        CoachId = t.CoachId,
        PlayerCount = t.Players?.Count ?? 0
    };
}
