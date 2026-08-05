using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITrainingSessionService
{
    Task<List<TrainingSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId);
    Task<List<TrainingSessionDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
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

    public async Task<List<TrainingSessionDto>> GetForTeamAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var sessions = await _context.TrainingSessions.Where(s => s.TeamId == teamId)
            .OrderByDescending(s => s.Date).ToListAsync();
        return sessions.Select(ToDto).ToList();
    }

    public async Task<List<TrainingSessionDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var sessions = await _context.TrainingSessions.Where(s => s.PlayerId == playerId)
            .OrderByDescending(s => s.Date).ToListAsync();
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

        session.Date = dto.Date;
        session.DurationMinutes = dto.DurationMinutes;
        session.Notes = dto.Notes;
        session.AttendanceStatus = dto.AttendanceStatus;
        await _context.SaveChangesAsync();
        return ToDto(session);
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
