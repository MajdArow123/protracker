using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITrainingSessionService
{
    Task<List<TrainingSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId, int? seasonId = null);
    Task<List<TrainingSessionDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int? seasonId = null);
    Task<TrainingSessionDto> CreateAsync(ClaimsPrincipal user, CreateTrainingSessionDto dto);
    Task<TrainingSessionDto> UpdateAsync(ClaimsPrincipal user, int id, CreateTrainingSessionDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class TrainingSessionService : ITrainingSessionService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly ISeasonStamper _seasons;

    public TrainingSessionService(ApplicationDbContext context, IAccessControlService access, ISeasonStamper seasons)
    {
        _context = context;
        _access = access;
        _seasons = seasons;
    }

    public async Task<List<TrainingSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId, int? seasonId = null)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var query = _context.TrainingSessions.Where(s => s.TeamId == teamId);
        if (seasonId is int sid)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid);
            query = query.Where(s => s.SeasonId == sid);
        }
        var sessions = await query
            .OrderByDescending(s => s.Date).ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<List<TrainingSessionDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int? seasonId = null)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var query = _context.TrainingSessions.Where(s => s.PlayerId == playerId);
        if (seasonId is int sid)
        {
            await _access.EnsureCanAccessSeasonAsync(user, sid);
            query = query.Where(s => s.SeasonId == sid);
        }
        var sessions = await query.OrderByDescending(s => s.Date).ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<TrainingSessionDto> CreateAsync(ClaimsPrincipal user, CreateTrainingSessionDto dto)
    {
        await _access.EnsureCanAccessTeamAsync(user, dto.TeamId);
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        // Team-context season stamp — the record pins its own TeamId, so resolving on
        // that + the session's date is historically exact. Metadata, never blocks (S3).
        var stamp = await _seasons.ForTeamAsync(dto.TeamId, DateOnly.FromDateTime(dto.Date));
        var session = new TrainingSession
        {
            PlayerId = dto.PlayerId,
            TeamId = dto.TeamId,
            Date = dto.Date,
            DurationMinutes = dto.DurationMinutes,
            Notes = dto.Notes,
            AttendanceStatus = dto.AttendanceStatus,
            SeasonId = stamp.SeasonId,
        };
        _context.TrainingSessions.Add(session);
        await _context.SaveChangesAsync();
        var result = ToDto(session);
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    public async Task<TrainingSessionDto> UpdateAsync(ClaimsPrincipal user, int id, CreateTrainingSessionDto dto)
    {
        var session = await _context.TrainingSessions.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundApiException($"Training session {id} was not found.");
        await _access.EnsureCanAccessTeamAsync(user, session.TeamId);

        var dateChanged = session.Date != dto.Date;
        session.Date = dto.Date;
        session.DurationMinutes = dto.DurationMinutes;
        session.Notes = dto.Notes;
        session.AttendanceStatus = dto.AttendanceStatus;

        // Date-changing update: re-resolve on the session's own TeamId (immutable on
        // update) and restamp. Metadata, never blocks; untouched dates never re-resolve.
        SeasonResolutionNoticeDto? seasonNotice = null;
        if (dateChanged)
        {
            var restamp = await _seasons.RestampForTeamAsync(
                session.TeamId, DateOnly.FromDateTime(dto.Date), session.SeasonId);
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
        var session = await _context.TrainingSessions.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundApiException($"Training session {id} was not found.");
        await _access.EnsureCanAccessTeamAsync(user, session.TeamId);

        _context.TrainingSessions.Remove(session);
        await _context.SaveChangesAsync();
    }

    private static TrainingSessionDto ToDto(TrainingSession s) => new()
    {
        Id = s.Id,
        PlayerId = s.PlayerId,
        TeamId = s.TeamId,
        Date = s.Date,
        DurationMinutes = s.DurationMinutes,
        Notes = s.Notes,
        AttendanceStatus = s.AttendanceStatus
    };
}
