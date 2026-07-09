using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ICoachConnectionService
{
    Task<MyConnectionRequestDto> SendAsync(ClaimsPrincipal user, string slug, SendConnectionRequestDto dto);
    Task<List<ConnectionRequestDto>> GetForCoachAsync(ClaimsPrincipal user, ConnectionRequestStatus? status);
    Task<ConnectionRequestDto> AcceptAsync(ClaimsPrincipal user, int id);
    Task<ConnectionRequestDto> DeclineAsync(ClaimsPrincipal user, int id, string? reason);
    Task<List<MyConnectionRequestDto>> GetForAthleteAsync(ClaimsPrincipal user);
    Task WithdrawAsync(ClaimsPrincipal user, int id);
}

public class CoachConnectionService : ICoachConnectionService
{
    private const int MaxPerDay = 5;

    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IJoinCodeService _joinCodes;
    private readonly IPushService _push;

    public CoachConnectionService(ApplicationDbContext context, IAccessControlService access,
        IJoinCodeService joinCodes, IPushService push)
    {
        _context = context;
        _access = access;
        _joinCodes = joinCodes;
        _push = push;
    }

    public async Task<MyConnectionRequestDto> SendAsync(ClaimsPrincipal user, string slug, SendConnectionRequestDto dto)
    {
        var normalized = (slug ?? "").Trim().ToLowerInvariant();
        var profile = await _context.CoachPublicProfiles.FirstOrDefaultAsync(p => p.Slug == normalized);
        if (profile == null || !profile.IsPublic)
            throw new NotFoundApiException("This coach profile is not available.");

        var athleteUserId = _access.RequireUserId(user);
        var player = await _access.RequireOwnPlayerAsync(user);

        if (profile.CoachUserId == athleteUserId)
            throw new ValidationApiException("You can't send a request to yourself.");

        // One pending request per athlete per coach.
        if (await _context.CoachConnectionRequests.AnyAsync(r =>
                r.AthleteUserId == athleteUserId && r.CoachUserId == profile.CoachUserId &&
                r.Status == ConnectionRequestStatus.Pending))
            throw new ValidationApiException("You already have a pending request with this coach.");

        // Rate limit: 5 requests per athlete per rolling 24h.
        var since = DateTime.UtcNow.AddDays(-1);
        if (await _context.CoachConnectionRequests.CountAsync(r => r.AthleteUserId == athleteUserId && r.RequestedAt >= since) >= MaxPerDay)
            throw new ValidationApiException("You've reached the daily limit of 5 connection requests. Please try again tomorrow.");

        var sportId = dto.Sport ?? player.SportId;
        var sportName = await _context.Sports.Where(s => s.Id == sportId).Select(s => s.Name).FirstOrDefaultAsync();
        var coach = await _context.Users.FirstOrDefaultAsync(u => u.Id == profile.CoachUserId);
        var athlete = await _context.Users.FirstOrDefaultAsync(u => u.Id == athleteUserId);

        var request = new CoachConnectionRequest
        {
            CoachUserId = profile.CoachUserId,
            CoachName = coach?.DisplayName ?? "",
            AthleteUserId = athleteUserId,
            AthleteName = string.IsNullOrWhiteSpace(player.FullName) ? (athlete?.DisplayName ?? "") : player.FullName,
            AthletePlayerId = player.Id,
            Message = Clean(dto.Message, 500),
            SportId = sportId,
            SportName = sportName,
            Status = ConnectionRequestStatus.Pending,
            RequestedAt = DateTime.UtcNow,
        };
        _context.CoachConnectionRequests.Add(request);
        await _context.SaveChangesAsync();

        _push.SendToUser(profile.CoachUserId, new PushPayload
        {
            Title = "New connection request",
            Body = $"{request.AthleteName} wants to connect with you on ProTracker.",
            Url = "/coach/connection-requests",
            Tag = "connection-request",
        });

        return ToMyDto(request, profile.Slug);
    }

    public async Task<List<ConnectionRequestDto>> GetForCoachAsync(ClaimsPrincipal user, ConnectionRequestStatus? status)
    {
        var coachUserId = _access.RequireUserId(user);
        var q = _context.CoachConnectionRequests.Where(r => r.CoachUserId == coachUserId);
        if (status is ConnectionRequestStatus s) q = q.Where(r => r.Status == s);
        var rows = await q.OrderByDescending(r => r.RequestedAt).ToListAsync();
        return rows.Select(ToDto).ToList();
    }

    public async Task<ConnectionRequestDto> AcceptAsync(ClaimsPrincipal user, int id)
    {
        var request = await LoadCoachRequestAsync(user, id);
        if (request.Status != ConnectionRequestStatus.Pending)
            throw new ValidationApiException("This request has already been responded to.");

        request.Status = ConnectionRequestStatus.Accepted;
        request.RespondedAt = DateTime.UtcNow;

        // If the athlete has no team yet, hand them a join code for one of the coach's teams
        // (preferring one that matches the request's sport).
        var player = request.AthletePlayerId is int pid
            ? await _context.Players.FirstOrDefaultAsync(p => p.Id == pid)
            : await _context.Players.FirstOrDefaultAsync(p => p.UserId == request.AthleteUserId);

        if (player == null || player.TeamId == null)
        {
            var code = await GetOrCreateJoinCodeAsync(user, request.CoachUserId, request.SportId);
            request.ResultJoinCode = code;
        }

        await _context.SaveChangesAsync();

        _push.SendToUser(request.AthleteUserId, new PushPayload
        {
            Title = "Connection accepted",
            Body = request.ResultJoinCode != null
                ? $"{request.CoachName} accepted your request. Use code {request.ResultJoinCode} to join."
                : $"{request.CoachName} accepted your connection request.",
            Tag = "connection-response",
        });

        return ToDto(request);
    }

    public async Task<ConnectionRequestDto> DeclineAsync(ClaimsPrincipal user, int id, string? reason)
    {
        var request = await LoadCoachRequestAsync(user, id);
        if (request.Status != ConnectionRequestStatus.Pending)
            throw new ValidationApiException("This request has already been responded to.");

        request.Status = ConnectionRequestStatus.Declined;
        request.CoachNote = Clean(reason, 500);
        request.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _push.SendToUser(request.AthleteUserId, new PushPayload
        {
            Title = "Connection update",
            Body = $"{request.CoachName} responded to your connection request.",
            Tag = "connection-response",
        });

        return ToDto(request);
    }

    public async Task<List<MyConnectionRequestDto>> GetForAthleteAsync(ClaimsPrincipal user)
    {
        var athleteUserId = _access.RequireUserId(user);
        var rows = await _context.CoachConnectionRequests
            .Where(r => r.AthleteUserId == athleteUserId)
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync();

        // Resolve each coach's public slug for linking back (best-effort).
        var coachIds = rows.Select(r => r.CoachUserId).Distinct().ToList();
        var slugs = await _context.CoachPublicProfiles
            .Where(p => coachIds.Contains(p.CoachUserId))
            .ToDictionaryAsync(p => p.CoachUserId, p => p.Slug);

        return rows.Select(r => ToMyDto(r, slugs.TryGetValue(r.CoachUserId, out var sl) ? sl : null)).ToList();
    }

    public async Task WithdrawAsync(ClaimsPrincipal user, int id)
    {
        var athleteUserId = _access.RequireUserId(user);
        var request = await _context.CoachConnectionRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.AthleteUserId == athleteUserId)
            ?? throw new NotFoundApiException("Request not found.");
        if (request.Status != ConnectionRequestStatus.Pending)
            throw new ValidationApiException("Only pending requests can be withdrawn.");
        _context.CoachConnectionRequests.Remove(request);
        await _context.SaveChangesAsync();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<CoachConnectionRequest> LoadCoachRequestAsync(ClaimsPrincipal user, int id)
    {
        var coachUserId = _access.RequireUserId(user);
        return await _context.CoachConnectionRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.CoachUserId == coachUserId)
            ?? throw new NotFoundApiException("Request not found.");
    }

    // Reuse an existing active, non-exhausted join code for one of the coach's teams
    // (sport-matched first); generate one only if none exists. Returns null if the coach
    // has no teams.
    private async Task<string?> GetOrCreateJoinCodeAsync(ClaimsPrincipal coach, string coachUserId, int? sportId)
    {
        var teams = await _context.CoachTeamScopes
            .Where(s => s.CoachId == coachUserId)
            .Select(s => new { s.TeamId, s.Team.SportId })
            .ToListAsync();
        if (teams.Count == 0) return null;

        var team = teams.FirstOrDefault(t => sportId != null && t.SportId == sportId) ?? teams.First();

        var existing = await _context.TeamJoinCodes
            .Where(c => c.TeamId == team.TeamId && c.IsActive &&
                        (c.ExpiresAt == null || c.ExpiresAt > DateTime.UtcNow) &&
                        (c.MaxUses == null || c.UseCount < c.MaxUses))
            .OrderByDescending(c => c.Id)
            .FirstOrDefaultAsync();
        if (existing != null) return existing.Code;

        var generated = await _joinCodes.GenerateAsync(coach, team.TeamId, new GenerateJoinCodeRequest());
        return generated.Code;
    }

    private static string? Clean(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }

    private static ConnectionRequestDto ToDto(CoachConnectionRequest r) => new()
    {
        Id = r.Id,
        CoachUserId = r.CoachUserId,
        CoachName = r.CoachName,
        AthleteUserId = r.AthleteUserId,
        AthleteName = r.AthleteName,
        AthletePlayerId = r.AthletePlayerId,
        Message = r.Message,
        SportId = r.SportId,
        SportName = r.SportName,
        Status = r.Status,
        CoachNote = r.CoachNote,
        ResultJoinCode = r.ResultJoinCode,
        RequestedAt = r.RequestedAt,
        RespondedAt = r.RespondedAt,
    };

    private static MyConnectionRequestDto ToMyDto(CoachConnectionRequest r, string? coachSlug) => new()
    {
        Id = r.Id,
        CoachName = r.CoachName,
        CoachSlug = coachSlug,
        Message = r.Message,
        SportName = r.SportName,
        Status = r.Status,
        ResultJoinCode = r.ResultJoinCode,
        RequestedAt = r.RequestedAt,
        RespondedAt = r.RespondedAt,
    };
}
