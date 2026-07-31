using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Auth;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITeamCoachService
{
    Task<List<TeamCoachDto>> ListCoachesAsync(ClaimsPrincipal user, int teamId);
    Task<CoachPermissionsDto> GetMyPermissionsAsync(ClaimsPrincipal user, int teamId);
    Task<InviteCoachResultDto> InviteCoachAsync(ClaimsPrincipal user, int teamId, InviteCoachDto dto);
    Task<TeamCoachDto> UpdatePermissionsAsync(ClaimsPrincipal user, int teamCoachRoleId, CoachPermissionsDto perms);
    Task RemoveAsync(ClaimsPrincipal user, int teamCoachRoleId);

    Task<ValidateCoachInviteDto> ValidateInviteAsync(string token);
    Task<LoginResponse> AcceptInviteAsync(AcceptCoachInviteDto dto);
}

public class TeamCoachService : ITeamCoachService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _tokens;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public TeamCoachService(ApplicationDbContext context, IAccessControlService access,
        UserManager<ApplicationUser> userManager, IJwtTokenService tokens, IEmailService email, IConfiguration config)
    {
        _context = context;
        _access = access;
        _userManager = userManager;
        _tokens = tokens;
        _email = email;
        _config = config;
    }

    public async Task<List<TeamCoachDto>> ListCoachesAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var currentUserId = _access.RequireUserId(user);
        var team = await _context.Teams.FirstAsync(t => t.Id == teamId);

        var list = new List<TeamCoachDto>();

        // Head coach.
        var head = await _userManager.FindByIdAsync(team.CoachId);
        if (head != null)
            list.Add(new TeamCoachDto
            {
                UserId = head.Id, Name = head.DisplayName, Email = head.Email,
                ProfilePictureUrl = head.ProfilePictureUrl, Role = CoachRoleType.HeadCoach,
                IsHeadCoach = true, IsYou = head.Id == currentUserId,
                Permissions = ToPermsDto(CoachPermissions.All()),
            });

        // Assistants / analysts.
        var roles = await _context.TeamCoachRoles.Where(r => r.TeamId == teamId).ToListAsync();
        foreach (var r in roles)
        {
            var u = await _userManager.FindByIdAsync(r.UserId);
            list.Add(new TeamCoachDto
            {
                Id = r.Id, UserId = r.UserId, Name = u?.DisplayName ?? "", Email = u?.Email,
                ProfilePictureUrl = u?.ProfilePictureUrl, Role = r.Role, IsHeadCoach = false,
                IsYou = r.UserId == currentUserId, Permissions = ToPermsDto(CoachPermissions.FromJson(r.PermissionsJson)),
                AcceptedAt = r.AcceptedAt,
            });
        }
        return list;
    }

    public async Task<CoachPermissionsDto> GetMyPermissionsAsync(ClaimsPrincipal user, int teamId)
    {
        var (perms, _) = await _access.GetTeamPermissionsAsync(user, teamId);
        return ToPermsDto(perms);
    }

    public async Task<InviteCoachResultDto> InviteCoachAsync(ClaimsPrincipal user, int teamId, InviteCoachDto dto)
    {
        var team = await RequireHeadCoachTeamAsync(user, teamId);
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ValidationApiException("A valid email is required.");

        var invite = new AssistantCoachInvite
        {
            TeamId = teamId,
            InviterUserId = _access.RequireUserId(user),
            Email = email,
            Role = dto.Role,
            PermissionsJson = FromPermsDto(dto.Permissions).ToJson(),
            Token = GenerateToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
        };
        _context.AssistantCoachInvites.Add(invite);
        await _context.SaveChangesAsync();

        var frontendUrl = (_config["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');
        var inviteUrl = $"{frontendUrl}/coach-invite/{invite.Token}";
        var inviter = await _userManager.FindByIdAsync(invite.InviterUserId);
        await _email.SendCoachInviteAsync(email, inviteUrl, team.Name, inviter?.DisplayName ?? "Your head coach", dto.Role.ToString());

        return new InviteCoachResultDto { Email = email, InviteUrl = inviteUrl };
    }

    public async Task<TeamCoachDto> UpdatePermissionsAsync(ClaimsPrincipal user, int teamCoachRoleId, CoachPermissionsDto perms)
    {
        var role = await _context.TeamCoachRoles.FirstOrDefaultAsync(r => r.Id == teamCoachRoleId)
            ?? throw new NotFoundApiException("Coach role not found.");
        await RequireHeadCoachTeamAsync(user, role.TeamId);

        role.PermissionsJson = FromPermsDto(perms).ToJson();
        await _context.SaveChangesAsync();

        var u = await _userManager.FindByIdAsync(role.UserId);
        return new TeamCoachDto
        {
            Id = role.Id, UserId = role.UserId, Name = u?.DisplayName ?? "", Email = u?.Email,
            ProfilePictureUrl = u?.ProfilePictureUrl, Role = role.Role, IsHeadCoach = false,
            Permissions = ToPermsDto(CoachPermissions.FromJson(role.PermissionsJson)), AcceptedAt = role.AcceptedAt,
        };
    }

    public async Task RemoveAsync(ClaimsPrincipal user, int teamCoachRoleId)
    {
        var role = await _context.TeamCoachRoles.FirstOrDefaultAsync(r => r.Id == teamCoachRoleId)
            ?? throw new NotFoundApiException("Coach role not found.");
        await RequireHeadCoachTeamAsync(user, role.TeamId);

        // Revoke team data access as well as the role.
        var scope = await _context.CoachTeamScopes.FirstOrDefaultAsync(s => s.TeamId == role.TeamId && s.CoachId == role.UserId);
        if (scope != null) _context.CoachTeamScopes.Remove(scope);
        _context.TeamCoachRoles.Remove(role);
        await _context.SaveChangesAsync();
    }

    public async Task<ValidateCoachInviteDto> ValidateInviteAsync(string token)
    {
        var invite = await _context.AssistantCoachInvites.Include(i => i.Team).ThenInclude(t => t.Sport)
            .FirstOrDefaultAsync(i => i.Token == token);
        if (invite == null || invite.AcceptedAt != null || invite.ExpiresAt < DateTime.UtcNow)
            return new ValidateCoachInviteDto { Valid = false };

        var inviter = await _userManager.FindByIdAsync(invite.InviterUserId);
        var existing = await _userManager.FindByEmailAsync(invite.Email);
        return new ValidateCoachInviteDto
        {
            Valid = true,
            TeamName = invite.Team.Name,
            SportName = invite.Team.Sport?.Name,
            InviterName = inviter?.DisplayName,
            Email = invite.Email,
            Role = invite.Role,
            EmailHasAccount = existing != null,
        };
    }

    public async Task<LoginResponse> AcceptInviteAsync(AcceptCoachInviteDto dto)
    {
        var invite = await _context.AssistantCoachInvites.FirstOrDefaultAsync(i => i.Token == dto.Token);
        if (invite == null || invite.AcceptedAt != null || invite.ExpiresAt < DateTime.UtcNow)
            throw new ValidationApiException("This invite is invalid or has expired.");

        var user = await _userManager.FindByEmailAsync(invite.Email);
        if (user == null)
        {
            if (string.IsNullOrWhiteSpace(dto.Password) || string.IsNullOrWhiteSpace(dto.FullName))
                throw new ValidationApiException("A name and password are required to create your account.");
            user = new ApplicationUser
            {
                UserName = invite.Email, Email = invite.Email, DisplayName = dto.FullName.Trim(),
            };
            var created = await _userManager.CreateAsync(user, dto.Password);
            if (!created.Succeeded)
                throw new ValidationApiException(created.Errors.Select(e => e.Description).ToList());
        }
        else
        {
            // Existing account — verify the password so a leaked invite token alone can't
            // grant a login to someone else's account.
            if (string.IsNullOrWhiteSpace(dto.Password) || !await _userManager.CheckPasswordAsync(user, dto.Password))
                throw new ValidationApiException("Incorrect password for this account.");
        }

        // Assistant coaches use the Coach role for the shared coach UI; the TeamCoachRole scopes
        // and permission-gates them to the specific team.
        if (!await _userManager.IsInRoleAsync(user, "Coach"))
            await _userManager.AddToRoleAsync(user, "Coach");

        // Grant team data access (reuses all existing coach scoping) — idempotent.
        if (!await _context.CoachTeamScopes.AnyAsync(s => s.TeamId == invite.TeamId && s.CoachId == user.Id))
            _context.CoachTeamScopes.Add(new CoachTeamScope { TeamId = invite.TeamId, CoachId = user.Id });

        // Create the coaching-staff membership — idempotent.
        var existingRole = await _context.TeamCoachRoles.FirstOrDefaultAsync(r => r.TeamId == invite.TeamId && r.UserId == user.Id);
        if (existingRole == null)
        {
            _context.TeamCoachRoles.Add(new TeamCoachRole
            {
                TeamId = invite.TeamId, UserId = user.Id, Role = invite.Role,
                InvitedByUserId = invite.InviterUserId, PermissionsJson = invite.PermissionsJson,
                AcceptedAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existingRole.PermissionsJson = invite.PermissionsJson;
            existingRole.Role = invite.Role;
            existingRole.AcceptedAt = DateTime.UtcNow;
        }

        invite.AcceptedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var roles = await _userManager.GetRolesAsync(user);
        return new LoginResponse
        {
            User = new UserInfoDto { Id = user.Id, Email = user.Email ?? "", DisplayName = user.DisplayName, Roles = roles.ToList() },
            AccessToken = _tokens.CreateAccessToken(user, roles),
            RefreshToken = await _tokens.CreateRefreshTokenAsync(user.Id),
        };
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<Team> RequireHeadCoachTeamAsync(ClaimsPrincipal user, int teamId)
    {
        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");
        if (!user.IsInRole("Admin"))
        {
            var userId = _access.RequireUserId(user);
            if (team.CoachId != userId)
                throw new ForbiddenApiException("Only the head coach can manage coaching staff.");
        }
        return team;
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static CoachPermissionsDto ToPermsDto(CoachPermissions p) => new()
    {
        CanAssessPlayers = p.CanAssessPlayers, CanAssignTasks = p.CanAssignTasks,
        CanViewPrivateNotes = p.CanViewPrivateNotes, CanManagePlayers = p.CanManagePlayers, CanManageTeam = p.CanManageTeam,
        CanPublishLineup = p.CanPublishLineup,
    };

    private static CoachPermissions FromPermsDto(CoachPermissionsDto p) => new()
    {
        CanAssessPlayers = p.CanAssessPlayers, CanAssignTasks = p.CanAssignTasks,
        CanViewPrivateNotes = p.CanViewPrivateNotes, CanManagePlayers = p.CanManagePlayers, CanManageTeam = p.CanManageTeam,
        CanPublishLineup = p.CanPublishLineup,
    };
}
