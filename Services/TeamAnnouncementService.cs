using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITeamAnnouncementService
{
    Task<List<TeamAnnouncementDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<List<TeamAnnouncementDto>> GetForMeAsync(ClaimsPrincipal user);
    Task<TeamAnnouncementDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateTeamAnnouncementDto dto);
    Task<TeamAnnouncementDto> UpdateAsync(ClaimsPrincipal user, int id, CreateTeamAnnouncementDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class TeamAnnouncementService : ITeamAnnouncementService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public TeamAnnouncementService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<TeamAnnouncementDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var items = await _context.TeamAnnouncements
            .Include(a => a.Team)
            .Where(a => a.TeamId == teamId)
            .ToListAsync();
        return Sort(items).Select(ToDto).ToList();
    }

    public async Task<List<TeamAnnouncementDto>> GetForMeAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var items = await _context.TeamAnnouncements
            .Include(a => a.Team)
            .Where(a => teamIds.Contains(a.TeamId))
            .ToListAsync();
        return Sort(items).Select(ToDto).ToList();
    }

    public async Task<TeamAnnouncementDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateTeamAnnouncementDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var userId = _access.RequireUserId(user);
        var coachName = (await _context.Users.FirstOrDefaultAsync(u => u.Id == userId))?.DisplayName ?? "";

        var announcement = new TeamAnnouncement
        {
            TeamId = teamId,
            CoachId = userId,
            CoachName = coachName,
            Title = dto.Title.Trim(),
            Content = dto.Content.Trim(),
            Priority = dto.Priority,
            IsPinned = dto.IsPinned,
        };
        _context.TeamAnnouncements.Add(announcement);
        await _context.SaveChangesAsync();
        await _context.Entry(announcement).Reference(a => a.Team).LoadAsync();
        return ToDto(announcement);
    }

    public async Task<TeamAnnouncementDto> UpdateAsync(ClaimsPrincipal user, int id, CreateTeamAnnouncementDto dto)
    {
        var announcement = await LoadAsync(id);
        await _access.EnsureCanAccessTeamAsync(user, announcement.TeamId);

        announcement.Title = dto.Title.Trim();
        announcement.Content = dto.Content.Trim();
        announcement.Priority = dto.Priority;
        announcement.IsPinned = dto.IsPinned;
        announcement.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(announcement);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var announcement = await LoadAsync(id);
        await _access.EnsureCanAccessTeamAsync(user, announcement.TeamId);
        _context.TeamAnnouncements.Remove(announcement);
        await _context.SaveChangesAsync();
    }

    private async Task<TeamAnnouncement> LoadAsync(int id)
    {
        return await _context.TeamAnnouncements
            .Include(a => a.Team)
            .FirstOrDefaultAsync(a => a.Id == id)
            ?? throw new NotFoundApiException($"Announcement {id} was not found.");
    }

    // Pinned first, then most recent.
    private static IEnumerable<TeamAnnouncement> Sort(IEnumerable<TeamAnnouncement> items) =>
        items.OrderByDescending(a => a.IsPinned).ThenByDescending(a => a.CreatedAt);

    private static TeamAnnouncementDto ToDto(TeamAnnouncement a) => new()
    {
        Id = a.Id,
        TeamId = a.TeamId,
        TeamName = a.Team?.Name ?? "",
        CoachId = a.CoachId,
        CoachName = a.CoachName,
        Title = a.Title,
        Content = a.Content,
        Priority = a.Priority,
        IsPinned = a.IsPinned,
        CreatedAt = a.CreatedAt,
        UpdatedAt = a.UpdatedAt,
    };
}
