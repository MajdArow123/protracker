using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IScheduledSessionService
{
    Task<List<ScheduledSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<List<ScheduledSessionDto>> GetUpcomingForMeAsync(ClaimsPrincipal user);
    Task<ScheduledSessionDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateScheduledSessionDto dto);
    Task<ScheduledSessionDto> UpdateAsync(ClaimsPrincipal user, int id, CreateScheduledSessionDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class ScheduledSessionService : IScheduledSessionService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public ScheduledSessionService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<ScheduledSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var sessions = await _context.ScheduledSessions
            .Include(s => s.Team)
            .Where(s => s.TeamId == teamId)
            .OrderBy(s => s.StartTime)
            .ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<List<ScheduledSessionDto>> GetUpcomingForMeAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var now = DateTime.UtcNow.AddHours(-12); // include sessions earlier today
        var sessions = await _context.ScheduledSessions
            .Include(s => s.Team)
            .Where(s => teamIds.Contains(s.TeamId) && s.StartTime >= now)
            .OrderBy(s => s.StartTime)
            .ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<ScheduledSessionDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateScheduledSessionDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var session = new ScheduledSession
        {
            TeamId = teamId,
            Title = dto.Title.Trim(),
            SessionType = dto.SessionType,
            StartTime = dto.StartTime,
            DurationMinutes = dto.DurationMinutes,
            Location = dto.Location,
            Focus = dto.Focus,
            Notes = dto.Notes,
        };
        _context.ScheduledSessions.Add(session);
        await _context.SaveChangesAsync();
        await _context.Entry(session).Reference(s => s.Team).LoadAsync();
        return ToDto(session);
    }

    public async Task<ScheduledSessionDto> UpdateAsync(ClaimsPrincipal user, int id, CreateScheduledSessionDto dto)
    {
        var session = await LoadAsync(id);
        await _access.EnsureCanAccessTeamAsync(user, session.TeamId);

        session.Title = dto.Title.Trim();
        session.SessionType = dto.SessionType;
        session.StartTime = dto.StartTime;
        session.DurationMinutes = dto.DurationMinutes;
        session.Location = dto.Location;
        session.Focus = dto.Focus;
        session.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        return ToDto(session);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var session = await LoadAsync(id);
        await _access.EnsureCanAccessTeamAsync(user, session.TeamId);
        _context.ScheduledSessions.Remove(session);
        await _context.SaveChangesAsync();
    }

    private async Task<ScheduledSession> LoadAsync(int id)
    {
        return await _context.ScheduledSessions
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundApiException($"Session {id} was not found.");
    }

    private static ScheduledSessionDto ToDto(ScheduledSession s) => new()
    {
        Id = s.Id,
        TeamId = s.TeamId,
        TeamName = s.Team?.Name ?? "",
        Title = s.Title,
        SessionType = s.SessionType,
        StartTime = s.StartTime,
        DurationMinutes = s.DurationMinutes,
        Location = s.Location,
        Focus = s.Focus,
        Notes = s.Notes,
    };
}
