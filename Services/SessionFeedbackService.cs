using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ISessionFeedbackService
{
    Task<SessionFeedbackDto> SubmitAsync(ClaimsPrincipal user, int sessionId, SubmitSessionFeedbackDto dto);
    Task<SessionFeedbackSummaryDto> GetForSessionAsync(ClaimsPrincipal user, int sessionId);
    Task<List<SessionFeedbackDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<List<MySessionFeedbackDto>> GetMineAsync(ClaimsPrincipal user);
    Task<SessionFeedbackAnalyticsDto> GetTeamAnalyticsAsync(ClaimsPrincipal user, int teamId);
}

public class SessionFeedbackService : ISessionFeedbackService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public SessionFeedbackService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<SessionFeedbackDto> SubmitAsync(ClaimsPrincipal user, int sessionId, SubmitSessionFeedbackDto dto)
    {
        Validate(dto);

        var session = await _context.ScheduledSessions.FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new NotFoundApiException($"Session {sessionId} was not found.");

        // The athlete submitting must own a player that belongs to this session.
        var player = await _access.RequireOwnPlayerAsync(user);
        await EnsurePlayerOnSessionAsync(player, session);

        if (session.StartTime > DateTime.UtcNow)
            throw new ValidationApiException("You can only rate a session once it has started.");

        // Upsert — one feedback per player per session.
        var feedback = await _context.SessionFeedbacks
            .FirstOrDefaultAsync(f => f.ScheduledSessionId == sessionId && f.PlayerId == player.Id);
        if (feedback == null)
        {
            feedback = new SessionFeedback { ScheduledSessionId = sessionId, PlayerId = player.Id };
            _context.SessionFeedbacks.Add(feedback);
        }

        feedback.Rating = dto.Rating;
        feedback.EnergyBefore = dto.EnergyBefore;
        feedback.EnergyAfter = dto.EnergyAfter;
        feedback.Difficulty = dto.Difficulty;
        feedback.WhatWentWell = Clean(dto.WhatWentWell);
        feedback.WhatWasHard = Clean(dto.WhatWasHard);
        feedback.InjuryNote = Clean(dto.InjuryNote);
        feedback.SubmittedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return ToDto(feedback, player.FullName, session);
    }

    public async Task<SessionFeedbackSummaryDto> GetForSessionAsync(ClaimsPrincipal user, int sessionId)
    {
        var session = await _context.ScheduledSessions.FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new NotFoundApiException($"Session {sessionId} was not found.");

        // Coaches need team access; solo athletes may view their own session's feedback.
        if (session.TeamId != null)
            await _access.EnsureCanAccessTeamAsync(user, session.TeamId.Value);
        else if (session.PlayerId != null)
            await _access.EnsureCanAccessPlayerAsync(user, session.PlayerId.Value);
        else
            throw new ForbiddenApiException();

        var responses = await _context.SessionFeedbacks
            .Include(f => f.Player)
            .Where(f => f.ScheduledSessionId == sessionId)
            .OrderByDescending(f => f.SubmittedAt)
            .ToListAsync();

        var teamCount = session.TeamId != null
            ? await _context.Players.CountAsync(p => p.TeamId == session.TeamId.Value)
            : 1;

        return new SessionFeedbackSummaryDto
        {
            ScheduledSessionId = sessionId,
            RespondedCount = responses.Count,
            TeamPlayerCount = teamCount,
            AverageRating = Avg(responses.Select(r => r.Rating)),
            AverageDifficulty = Avg(responses.Select(r => r.Difficulty)),
            AverageEnergyBefore = Avg(responses.Select(r => r.EnergyBefore)),
            AverageEnergyAfter = Avg(responses.Select(r => r.EnergyAfter)),
            InjuryFlagCount = responses.Count(r => !string.IsNullOrWhiteSpace(r.InjuryNote)),
            Responses = responses.Select(r => ToDto(r, r.Player.FullName, session)).ToList(),
        };
    }

    public async Task<List<SessionFeedbackDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var player = await _context.Players.FirstAsync(p => p.Id == playerId);

        var feedbacks = await _context.SessionFeedbacks
            .Include(f => f.ScheduledSession)
            .Where(f => f.PlayerId == playerId)
            .OrderByDescending(f => f.ScheduledSession.StartTime)
            .ToListAsync();

        return feedbacks.Select(f => ToDto(f, player.FullName, f.ScheduledSession)).ToList();
    }

    public async Task<List<MySessionFeedbackDto>> GetMineAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var now = DateTime.UtcNow;

        // Past sessions relevant to this athlete: their team's team-sessions, or their own
        // solo (player-scoped) sessions.
        var sessions = await _context.ScheduledSessions
            .Include(s => s.Team)
            .Where(s => s.StartTime <= now &&
                ((player.TeamId != null && s.TeamId == player.TeamId) || s.PlayerId == player.Id))
            .OrderByDescending(s => s.StartTime)
            .ToListAsync();

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var myFeedback = await _context.SessionFeedbacks
            .Where(f => f.PlayerId == player.Id && sessionIds.Contains(f.ScheduledSessionId))
            .ToListAsync();
        var bySession = myFeedback.ToDictionary(f => f.ScheduledSessionId);

        return sessions.Select(s => new MySessionFeedbackDto
        {
            Session = ToSessionDto(s),
            Feedback = bySession.TryGetValue(s.Id, out var f) ? ToDto(f, player.FullName, s) : null,
        }).ToList();
    }

    public async Task<SessionFeedbackAnalyticsDto> GetTeamAnalyticsAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);

        var rows = await _context.SessionFeedbacks
            .Include(f => f.ScheduledSession)
            .Where(f => f.ScheduledSession.TeamId == teamId)
            .ToListAsync();

        var trend = rows
            .GroupBy(f => f.ScheduledSession)
            .Select(g => new RatedSessionPointDto
            {
                ScheduledSessionId = g.Key.Id,
                Title = g.Key.Title,
                StartTime = g.Key.StartTime,
                SessionType = g.Key.SessionType,
                AverageRating = Math.Round(g.Average(x => x.Rating), 2),
                AverageDifficulty = Math.Round(g.Average(x => x.Difficulty), 2),
                RespondedCount = g.Count(),
                InjuryFlagCount = g.Count(x => !string.IsNullOrWhiteSpace(x.InjuryNote)),
            })
            .OrderBy(p => p.StartTime)
            .ToList();

        var byType = rows
            .GroupBy(f => f.ScheduledSession.SessionType)
            .Select(g => new SessionTypeRatingDto
            {
                SessionType = g.Key,
                AverageRating = Math.Round(g.Average(x => x.Rating), 2),
                AverageDifficulty = Math.Round(g.Average(x => x.Difficulty), 2),
                ResponseCount = g.Count(),
            })
            .OrderByDescending(t => t.AverageRating)
            .ToList();

        return new SessionFeedbackAnalyticsDto
        {
            TotalResponses = rows.Count,
            OverallAverageRating = Avg(rows.Select(r => r.Rating)),
            OverallAverageDifficulty = Avg(rows.Select(r => r.Difficulty)),
            InjuryFlagCount = rows.Count(r => !string.IsNullOrWhiteSpace(r.InjuryNote)),
            RatingTrend = trend,
            ByType = byType,
        };
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    private static Task EnsurePlayerOnSessionAsync(Player player, ScheduledSession session)
    {
        if (session.PlayerId != null)
        {
            if (session.PlayerId != player.Id)
                throw new ForbiddenApiException("This session doesn't belong to you.");
            return Task.CompletedTask;
        }
        if (session.TeamId != null)
        {
            if (player.TeamId != session.TeamId)
                throw new ForbiddenApiException("You are not on this session's team.");
            return Task.CompletedTask;
        }
        throw new ForbiddenApiException();
    }

    private static void Validate(SubmitSessionFeedbackDto dto)
    {
        var errors = new List<string>();
        void Range(int v, string name) { if (v < 1 || v > 5) errors.Add($"{name} must be between 1 and 5."); }
        Range(dto.Rating, "Rating");
        Range(dto.EnergyBefore, "EnergyBefore");
        Range(dto.EnergyAfter, "EnergyAfter");
        Range(dto.Difficulty, "Difficulty");
        if (errors.Count > 0) throw new ValidationApiException(errors);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static double? Avg(IEnumerable<int> values)
    {
        var list = values.ToList();
        return list.Count == 0 ? null : Math.Round(list.Average(), 2);
    }

    private static SessionFeedbackDto ToDto(SessionFeedback f, string playerName, ScheduledSession? session) => new()
    {
        Id = f.Id,
        ScheduledSessionId = f.ScheduledSessionId,
        PlayerId = f.PlayerId,
        PlayerName = playerName,
        Rating = f.Rating,
        EnergyBefore = f.EnergyBefore,
        EnergyAfter = f.EnergyAfter,
        Difficulty = f.Difficulty,
        WhatWentWell = f.WhatWentWell,
        WhatWasHard = f.WhatWasHard,
        InjuryNote = f.InjuryNote,
        SubmittedAt = f.SubmittedAt,
        SessionTitle = session?.Title,
        SessionType = session?.SessionType,
        SessionStartTime = session?.StartTime,
    };

    private static ScheduledSessionDto ToSessionDto(ScheduledSession s) => new()
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
