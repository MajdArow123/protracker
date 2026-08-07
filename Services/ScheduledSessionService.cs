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
    // Solo athletes: personal (player-scoped, team-less) sessions.
    Task<List<ScheduledSessionDto>> GetMySoloSessionsAsync(ClaimsPrincipal user);
    Task<ScheduledSessionDto> CreateForSelfAsync(ClaimsPrincipal user, CreateScheduledSessionDto dto);
}

public class ScheduledSessionService : IScheduledSessionService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly ISeasonStamper _seasons;

    public ScheduledSessionService(ApplicationDbContext context, IAccessControlService access, ISeasonStamper seasons)
    {
        _context = context;
        _access = access;
        _seasons = seasons;
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
        var query = _context.ScheduledSessions
            .Include(s => s.Team)
            .Where(s => s.TeamId != null && teamIds.Contains(s.TeamId.Value) && s.StartTime >= now);

        // Solo athletes see their own player-scoped sessions instead.
        if (_access.IsSoloAthlete(user))
        {
            var userId = _access.RequireUserId(user);
            query = _context.ScheduledSessions
                .Where(s => s.PlayerId != null && s.Player!.UserId == userId && s.StartTime >= now);
        }

        var sessions = await query.OrderBy(s => s.StartTime).ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    // Full personal schedule (past + upcoming) for the solo training calendar.
    public async Task<List<ScheduledSessionDto>> GetMySoloSessionsAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var sessions = await _context.ScheduledSessions
            .Where(s => s.PlayerId == player.Id)
            .OrderBy(s => s.StartTime)
            .ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<ScheduledSessionDto> CreateForSelfAsync(ClaimsPrincipal user, CreateScheduledSessionDto dto)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        // Season resolution uses the client's LOCAL date of the session (S2.2 ruling —
        // the UTC date part of StartTime is only the fallback). Player-context stamp;
        // metadata, never blocks (S3).
        var sessionDate = ClientLocalDate.Resolve(dto.LocalDate,
            DateOnly.FromDateTime(dto.StartTime), "the session's start date");
        var stamp = await _seasons.ForPlayerAsync(player.Id, sessionDate);
        var session = new ScheduledSession
        {
            PlayerId = player.Id,
            Title = dto.Title.Trim(),
            SessionType = dto.SessionType,
            StartTime = dto.StartTime,
            DurationMinutes = dto.DurationMinutes,
            Location = dto.Location,
            Focus = dto.Focus,
            Notes = dto.Notes,
            SeasonId = stamp.SeasonId,
        };
        _context.ScheduledSessions.Add(session);
        await _context.SaveChangesAsync();
        var result = ToDto(session);
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    public async Task<ScheduledSessionDto> CreateAsync(ClaimsPrincipal user, int teamId, CreateScheduledSessionDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        // Team-context stamp on the client's LOCAL session date (see CreateForSelfAsync).
        var sessionDate = ClientLocalDate.Resolve(dto.LocalDate,
            DateOnly.FromDateTime(dto.StartTime), "the session's start date");
        var stamp = await _seasons.ForTeamAsync(teamId, sessionDate);
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
            SeasonId = stamp.SeasonId,
        };
        _context.ScheduledSessions.Add(session);
        await _context.SaveChangesAsync();
        await _context.Entry(session).Reference(s => s.Team).LoadAsync();
        var result = ToDto(session);
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    // Team sessions require team access; personal sessions require player ownership.
    private async Task EnsureCanManageSessionAsync(ClaimsPrincipal user, ScheduledSession session)
    {
        if (session.PlayerId != null)
            await _access.EnsureCanAccessPlayerAsync(user, session.PlayerId.Value);
        else if (session.TeamId != null)
            await _access.EnsureCanAccessTeamAsync(user, session.TeamId.Value);
        else
            throw new ForbiddenApiException();
    }

    public async Task<ScheduledSessionDto> UpdateAsync(ClaimsPrincipal user, int id, CreateScheduledSessionDto dto)
    {
        var session = await LoadAsync(id);
        await EnsureCanManageSessionAsync(user, session);

        var startChanged = session.StartTime != dto.StartTime;
        session.Title = dto.Title.Trim();
        session.SessionType = dto.SessionType;
        session.StartTime = dto.StartTime;
        session.DurationMinutes = dto.DurationMinutes;
        session.Location = dto.Location;
        session.Focus = dto.Focus;
        session.Notes = dto.Notes;

        // StartTime-changing update: re-resolve on the client's LOCAL date of the new
        // StartTime (S2.2 — the stored row has no local date to compare, so any StartTime
        // change re-resolves; a local-midnight crossing invisible to the UTC day is then
        // never missed) and restamp. Metadata, never blocks; untouched StartTime never
        // re-resolves.
        SeasonResolutionNoticeDto? seasonNotice = null;
        if (startChanged)
        {
            var sessionDate = ClientLocalDate.Resolve(dto.LocalDate,
                DateOnly.FromDateTime(dto.StartTime), "the session's start date");
            var restamp = session.PlayerId != null
                ? await _seasons.RestampForPlayerAsync(session.PlayerId.Value, sessionDate, session.SeasonId)
                : await _seasons.RestampForTeamAsync(session.TeamId!.Value, sessionDate, session.SeasonId);
            session.SeasonId = restamp.SeasonId;
            seasonNotice = restamp.Notice;
        }
        await _context.SaveChangesAsync();
        var result = ToDto(session);
        result.SeasonNotice = seasonNotice;
        return result;
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var session = await LoadAsync(id);
        await EnsureCanManageSessionAsync(user, session);
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
        PlayerId = s.PlayerId,
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
