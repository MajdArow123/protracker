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
    Task<string> SetPhotoAsync(ClaimsPrincipal user, int id, IFormFile file);
    Task RemovePhotoAsync(ClaimsPrincipal user, int id);
}

public class TeamService : ITeamService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IBillingService _billing;
    private readonly IImageService _images;

    public TeamService(ApplicationDbContext context, IAccessControlService access, IBillingService billing, IImageService images)
    {
        _context = context;
        _access = access;
        _billing = billing;
        _images = images;
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
            PhotoUrl = dto.PhotoUrl,
            FoundedYear = dto.FoundedYear,
            Description = dto.Description,
            Players = team.Players.Select(PlayerService.ToDto).ToList()
        };
    }

    public async Task<TeamDto> CreateAsync(ClaimsPrincipal user, TeamCreateDto dto)
    {
        var coachId = _access.RequireUserId(user);
        await _billing.EnsureCanCreateTeamAsync(user);

        if (!await _context.Sports.AnyAsync(s => s.Id == dto.SportId))
            throw new ValidationApiException($"Sport {dto.SportId} does not exist.");

        // Coaches are locked to the sport of their existing teams
        var existingSportId = await _context.Teams
            .Where(t => t.CoachId == coachId)
            .Select(t => (int?)t.SportId)
            .FirstOrDefaultAsync();
        if (existingSportId.HasValue && existingSportId.Value != dto.SportId)
            throw new ValidationApiException("You can only create teams in the same sport as your existing teams.");

        ValidateTeamDetails(dto.FoundedYear, dto.Description);
        var team = new Team
        {
            Name = dto.Name,
            SportId = dto.SportId,
            CoachId = coachId,
            FoundedYear = dto.FoundedYear,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
        };
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

        ValidateTeamDetails(dto.FoundedYear, dto.Description);
        team.Name = dto.Name;
        team.FoundedYear = dto.FoundedYear;
        team.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
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

    public async Task<string> SetPhotoAsync(ClaimsPrincipal user, int id, IFormFile file)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);
        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Team {id} was not found.");

        team.PhotoUrl = await _images.ToSquareJpegDataUrlAsync(file, 400);
        await _context.SaveChangesAsync();
        return team.PhotoUrl;
    }

    public async Task RemovePhotoAsync(ClaimsPrincipal user, int id)
    {
        await _access.EnsureCanAccessTeamAsync(user, id);
        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Team {id} was not found.");

        team.PhotoUrl = null;
        await _context.SaveChangesAsync();
    }

    private static TeamDto ToDto(Team t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        SportId = t.SportId,
        SportName = t.Sport?.Name ?? "",
        CoachId = t.CoachId,
        PlayerCount = t.Players?.Count ?? 0,
        PhotoUrl = t.PhotoUrl,
        FoundedYear = t.FoundedYear,
        Description = t.Description
    };

    private static void ValidateTeamDetails(int? foundedYear, string? description)
    {
        if (foundedYear.HasValue && (foundedYear < 1850 || foundedYear > DateTime.UtcNow.Year))
            throw new ValidationApiException($"Founded year must be between 1850 and {DateTime.UtcNow.Year}.");
        if (description is { Length: > 500 })
            throw new ValidationApiException("Team description must be 500 characters or fewer.");
    }
}
