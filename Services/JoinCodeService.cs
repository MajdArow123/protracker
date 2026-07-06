using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IJoinCodeService
{
    Task<TeamJoinCodeDto> GenerateAsync(ClaimsPrincipal coach, int teamId, GenerateJoinCodeRequest request);
    Task<List<TeamJoinCodeDto>> GetForTeamAsync(ClaimsPrincipal coach, int teamId);
    Task DeactivateAsync(ClaimsPrincipal coach, int joinCodeId);
    Task<ValidateJoinCodeResponse> ValidateAsync(string code);
    Task<AthleteInviteResultDto> InviteAthleteAsync(ClaimsPrincipal coach, int teamId, string email);
    Task<List<AthleteInviteDto>> GetInvitesAsync(ClaimsPrincipal coach, int teamId);
}

public class JoinCodeService : IJoinCodeService
{
    // No 0/O/1/I — codes get read out loud and typed from printouts.
    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public JoinCodeService(
        ApplicationDbContext context, IAccessControlService access,
        UserManager<ApplicationUser> userManager, IEmailService email, IConfiguration config)
    {
        _context = context;
        _access = access;
        _userManager = userManager;
        _email = email;
        _config = config;
    }

    public async Task<TeamJoinCodeDto> GenerateAsync(ClaimsPrincipal coach, int teamId, GenerateJoinCodeRequest request)
    {
        await _access.EnsureCanAccessTeamAsync(coach, teamId);
        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        // One active code per team: generating a new one retires the old ones.
        var actives = await _context.TeamJoinCodes.Where(c => c.TeamId == teamId && c.IsActive).ToListAsync();
        foreach (var a in actives) a.IsActive = false;

        var joinCode = new TeamJoinCode
        {
            TeamId = teamId,
            CoachId = _access.RequireUserId(coach),
            Code = await GenerateUniqueCodeAsync(team.Name),
            ExpiresAt = request.ExpiresInDays.HasValue ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value) : null,
            MaxUses = request.MaxUses,
        };
        _context.TeamJoinCodes.Add(joinCode);
        await _context.SaveChangesAsync();

        return ToDto(joinCode);
    }

    public async Task<List<TeamJoinCodeDto>> GetForTeamAsync(ClaimsPrincipal coach, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(coach, teamId);
        var codes = await _context.TeamJoinCodes
            .Where(c => c.TeamId == teamId)
            .OrderByDescending(c => c.IsActive).ThenByDescending(c => c.CreatedAt)
            .ToListAsync();
        return codes.Select(ToDto).ToList();
    }

    public async Task DeactivateAsync(ClaimsPrincipal coach, int joinCodeId)
    {
        var code = await _context.TeamJoinCodes.FirstOrDefaultAsync(c => c.Id == joinCodeId)
            ?? throw new NotFoundApiException("Join code not found.");
        await _access.EnsureCanAccessTeamAsync(coach, code.TeamId);

        code.IsActive = false;
        await _context.SaveChangesAsync();
    }

    public async Task<ValidateJoinCodeResponse> ValidateAsync(string code)
    {
        var normalized = (code ?? "").Trim().ToUpperInvariant();
        var entry = await _context.TeamJoinCodes
            .Include(c => c.Team).ThenInclude(t => t.Sport)
            .FirstOrDefaultAsync(c => c.Code == normalized);

        if (entry == null) return new ValidateJoinCodeResponse { Valid = false, Reason = "notfound" };
        if (!entry.IsActive) return new ValidateJoinCodeResponse { Valid = false, Reason = "inactive" };
        if (entry.ExpiresAt.HasValue && entry.ExpiresAt.Value < DateTime.UtcNow)
            return new ValidateJoinCodeResponse { Valid = false, Reason = "expired" };
        if (entry.MaxUses.HasValue && entry.UseCount >= entry.MaxUses.Value)
            return new ValidateJoinCodeResponse { Valid = false, Reason = "maxed" };

        var coach = await _userManager.FindByIdAsync(entry.Team.CoachId);
        var positions = await _context.Positions
            .Where(p => p.SportId == entry.Team.SportId)
            .OrderBy(p => p.Id)
            .Select(p => new PositionOptionDto { Id = p.Id, Name = p.Name })
            .ToListAsync();

        return new ValidateJoinCodeResponse
        {
            Valid = true,
            TeamId = entry.TeamId,
            TeamName = entry.Team.Name,
            Sport = entry.Team.Sport.Name,
            CoachName = coach?.DisplayName ?? "Your coach",
            Code = entry.Code,
            Positions = positions,
        };
    }

    public async Task<AthleteInviteResultDto> InviteAthleteAsync(ClaimsPrincipal coach, int teamId, string email)
    {
        await _access.EnsureCanAccessTeamAsync(coach, teamId);
        var normalized = (email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized) || !normalized.Contains('@'))
            throw new ValidationApiException("A valid athlete email is required.");

        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        // An athlete already on this team doesn't need an invite.
        var existingUser = await _userManager.FindByEmailAsync(normalized);
        if (existingUser != null && await _context.Players.AnyAsync(p => p.TeamId == teamId && p.UserId == existingUser.Id))
            throw new ValidationApiException("An athlete with this email is already on the team.");

        var coachId = _access.RequireUserId(coach);
        var coachUser = await _userManager.FindByIdAsync(coachId);

        // Reuse the team's active code, or mint one so the invite link always works.
        var active = await _context.TeamJoinCodes
            .Where(c => c.TeamId == teamId && c.IsActive
                && (c.ExpiresAt == null || c.ExpiresAt > DateTime.UtcNow)
                && (c.MaxUses == null || c.UseCount < c.MaxUses))
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();
        if (active == null)
        {
            active = new TeamJoinCode { TeamId = teamId, CoachId = coachId, Code = await GenerateUniqueCodeAsync(team.Name) };
            _context.TeamJoinCodes.Add(active);
        }

        _context.AthleteInvites.Add(new AthleteInvite
        {
            TeamId = teamId,
            Email = normalized,
            InvitedByCoachId = coachId,
            JoinCode = active.Code,
        });
        await _context.SaveChangesAsync();

        var frontendUrl = (_config["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');
        var joinUrl = $"{frontendUrl}/join/{active.Code}";
        await _email.SendAthleteInviteAsync(normalized, joinUrl, team.Name, coachUser?.DisplayName ?? "Your coach");

        return new AthleteInviteResultDto
        {
            Email = normalized,
            JoinUrl = joinUrl,
            EmailSent = !string.IsNullOrWhiteSpace(_config["SMTP_HOST"]),
        };
    }

    public async Task<List<AthleteInviteDto>> GetInvitesAsync(ClaimsPrincipal coach, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(coach, teamId);

        var invites = await _context.AthleteInvites
            .Where(i => i.TeamId == teamId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        return invites.Select(i => new AthleteInviteDto
        {
            Id = i.Id,
            Email = i.Email,
            CreatedAt = i.CreatedAt,
            Status = i.AcceptedAt.HasValue ? "Joined" : "Pending",
        }).ToList();
    }

    // "CITY" (from the team name) + 4 random chars, retried until unique. Falls back to
    // fully random when the team name has fewer than 2 usable characters.
    private async Task<string> GenerateUniqueCodeAsync(string teamName)
    {
        var prefix = new string(teamName.ToUpperInvariant().Where(ch => CodeAlphabet.Contains(ch)).Take(4).ToArray());
        if (prefix.Length < 2) prefix = "";

        for (var attempt = 0; attempt < 25; attempt++)
        {
            var randomLen = 8 - prefix.Length;
            var chars = new char[randomLen];
            for (var i = 0; i < randomLen; i++)
                chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
            var code = prefix + new string(chars);

            if (!await _context.TeamJoinCodes.AnyAsync(c => c.Code == code))
                return code;
        }
        throw new InvalidOperationException("Could not generate a unique join code.");
    }

    private static TeamJoinCodeDto ToDto(TeamJoinCode c) => new()
    {
        Id = c.Id,
        TeamId = c.TeamId,
        Code = c.Code,
        IsActive = c.IsActive,
        ExpiresAt = c.ExpiresAt,
        MaxUses = c.MaxUses,
        UseCount = c.UseCount,
        CreatedAt = c.CreatedAt,
    };
}
