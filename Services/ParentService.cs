using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IParentService
{
    Task<ParentInviteResultDto> InviteAsync(ClaimsPrincipal coach, CreateParentInviteDto dto);
    Task<List<PlayerParentDto>> GetPlayerParentsAsync(ClaimsPrincipal coach, int playerId);
    Task<ParentInviteInfoDto> ValidateInviteAsync(string token);
    Task AcceptInviteAsync(AcceptParentInviteDto dto);
    Task<List<ParentChildDto>> GetChildrenAsync(ClaimsPrincipal parent);
    Task<ChildOverviewDto> GetChildOverviewAsync(ClaimsPrincipal parent, int playerId);
}

public class ParentService : IParentService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly UserManager<ApplicationUser> _userManager;

    public ParentService(
        ApplicationDbContext context, IAccessControlService access, IEmailService email,
        IConfiguration config, UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _access = access;
        _email = email;
        _config = config;
        _userManager = userManager;
    }

    public async Task<ParentInviteResultDto> InviteAsync(ClaimsPrincipal coach, CreateParentInviteDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(coach, dto.PlayerId);
        var email = dto.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ValidationApiException("A valid parent email is required.");
        if (string.IsNullOrWhiteSpace(dto.ParentName))
            throw new ValidationApiException("Parent name is required.");

        var player = await _context.Players.FirstAsync(p => p.Id == dto.PlayerId);
        var coachId = _access.RequireUserId(coach);
        var coachUser = await _userManager.FindByIdAsync(coachId);

        var token = GenerateToken();
        _context.ParentInvites.Add(new ParentInvite
        {
            Token = token,
            Email = email,
            ParentName = dto.ParentName.Trim(),
            PlayerId = dto.PlayerId,
            InvitedByCoachId = coachId,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();

        var frontendUrl = (_config["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');
        var inviteUrl = $"{frontendUrl}/parent-invite?token={token}";
        await _email.SendParentInviteAsync(email, inviteUrl, player.FullName, coachUser?.DisplayName ?? "Your coach");

        return new ParentInviteResultDto
        {
            Email = email,
            ParentName = dto.ParentName.Trim(),
            InviteUrl = inviteUrl,
            EmailSent = !string.IsNullOrWhiteSpace(_config["SMTP_HOST"]),
        };
    }

    public async Task<List<PlayerParentDto>> GetPlayerParentsAsync(ClaimsPrincipal coach, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(coach, playerId);

        // Accepted parents.
        var links = await _context.ParentLinks.Where(l => l.PlayerId == playerId).ToListAsync();
        var linkUserIds = links.Select(l => l.ParentUserId).ToList();
        var users = await _userManager.Users.Where(u => linkUserIds.Contains(u.Id)).ToListAsync();
        var result = links.Select(l =>
        {
            var u = users.FirstOrDefault(x => x.Id == l.ParentUserId);
            return new PlayerParentDto
            {
                Name = u?.DisplayName ?? "Parent",
                Email = u?.Email ?? "",
                Status = "Active",
                CreatedAt = l.CreatedAt,
            };
        }).ToList();

        // Pending invites (not yet accepted, not expired) whose email isn't already linked.
        var linkedEmails = users.Select(u => u.Email?.ToLowerInvariant()).ToHashSet();
        var pending = await _context.ParentInvites
            .Where(i => i.PlayerId == playerId && !i.IsUsed && i.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        foreach (var inv in pending)
        {
            if (linkedEmails.Contains(inv.Email.ToLowerInvariant())) continue;
            result.Add(new PlayerParentDto { Name = inv.ParentName, Email = inv.Email, Status = "Pending", CreatedAt = inv.CreatedAt });
        }

        return result.OrderBy(r => r.Status).ThenBy(r => r.Name).ToList();
    }

    public async Task<ParentInviteInfoDto> ValidateInviteAsync(string token)
    {
        var invite = await _context.ParentInvites
            .Include(i => i.Player)
            .FirstOrDefaultAsync(i => i.Token == token);
        if (invite == null || invite.IsUsed || invite.ExpiresAt < DateTime.UtcNow)
            return new ParentInviteInfoDto { Valid = false };

        var coach = await _userManager.FindByIdAsync(invite.InvitedByCoachId);
        var existing = await _userManager.FindByEmailAsync(invite.Email);

        return new ParentInviteInfoDto
        {
            Valid = true,
            Email = invite.Email,
            ParentName = invite.ParentName,
            PlayerName = invite.Player.FullName,
            CoachName = coach?.DisplayName ?? "Your coach",
            AccountExists = existing != null,
        };
    }

    public async Task AcceptInviteAsync(AcceptParentInviteDto dto)
    {
        var invite = await _context.ParentInvites.FirstOrDefaultAsync(i => i.Token == dto.Token);
        if (invite == null || invite.IsUsed || invite.ExpiresAt < DateTime.UtcNow)
            throw new ValidationApiException("This invite link is invalid or has expired.");
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 8)
            throw new ValidationApiException("Password must be at least 8 characters.");

        var existing = await _userManager.FindByEmailAsync(invite.Email);
        string parentUserId;

        if (existing != null)
        {
            // Existing account: it must be a parent, and they must authenticate with their password.
            if (!await _userManager.IsInRoleAsync(existing, "Parent"))
                throw new ValidationApiException("This email is already registered to another account.");
            if (!await _userManager.CheckPasswordAsync(existing, dto.Password))
                throw new ValidationApiException("That password doesn't match your existing ProTracker account.");
            parentUserId = existing.Id;
        }
        else
        {
            var user = new ApplicationUser { UserName = invite.Email, Email = invite.Email, DisplayName = invite.ParentName };
            var created = await _userManager.CreateAsync(user, dto.Password);
            if (!created.Succeeded)
                throw new ValidationApiException(string.Join("; ", created.Errors.Select(e => e.Description)));
            await _userManager.AddToRoleAsync(user, "Parent");
            parentUserId = user.Id;
        }

        var alreadyLinked = await _context.ParentLinks.AnyAsync(l => l.ParentUserId == parentUserId && l.PlayerId == invite.PlayerId);
        if (!alreadyLinked)
            _context.ParentLinks.Add(new ParentLink { ParentUserId = parentUserId, PlayerId = invite.PlayerId });

        invite.IsUsed = true;
        await _context.SaveChangesAsync();
    }

    public async Task<List<ParentChildDto>> GetChildrenAsync(ClaimsPrincipal parent)
    {
        var ids = await _access.GetParentPlayerIdsAsync(parent);
        if (ids.Count == 0) return new();

        var players = await _context.Players
            .Include(p => p.Team).Include(p => p.Sport).Include(p => p.Position)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        var scores = await _context.PlayerAssessments
            .Where(a => ids.Contains(a.PlayerId))
            .SelectMany(a => a.StatScores.Select(s => new { a.PlayerId, Score = (double)s.Score }))
            .ToListAsync();

        var injuries = await _context.InjuryRecords
            .Where(i => ids.Contains(i.PlayerId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .Select(i => i.PlayerId)
            .ToListAsync();

        return players.Select(p =>
        {
            var pScores = scores.Where(s => s.PlayerId == p.Id).Select(s => s.Score).ToList();
            return new ParentChildDto
            {
                PlayerId = p.Id,
                FullName = p.FullName,
                TeamName = p.Team?.Name,
                SportName = p.Sport?.Name,
                PositionName = p.Position?.Name,
                Age = p.Age,
                FitnessLevel = p.FitnessLevel,
                OverallAverage = pScores.Count > 0 ? Math.Round(pScores.Average(), 1) : null,
                ActiveInjuryCount = injuries.Count(id => id == p.Id),
            };
        }).OrderBy(c => c.FullName).ToList();
    }

    public async Task<ChildOverviewDto> GetChildOverviewAsync(ClaimsPrincipal parent, int playerId)
    {
        await EnsureLinkedAsync(parent, playerId);

        var player = await _context.Players
            .Include(p => p.Team).Include(p => p.Sport).Include(p => p.Position)
            .FirstAsync(p => p.Id == playerId);

        var assessments = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .ToListAsync();

        var allScores = assessments.SelectMany(a => a.StatScores).ToList();
        var byCategory = allScores
            .GroupBy(s => s.SportStatCategory.Name)
            .ToDictionary(g => g.Key, g => Math.Round((double)g.Average(s => s.Score), 1));

        var injuries = await _context.InjuryRecords
            .Where(i => i.PlayerId == playerId && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .OrderByDescending(i => i.Severity).ThenByDescending(i => i.InjuryDate)
            .Select(i => new ChildInjuryDto
            {
                InjuryType = i.InjuryType,
                BodyPart = i.BodyPart,
                Severity = i.Severity.ToString(),
                RecoveryStatus = i.RecoveryStatus.ToString(),
                InjuryDate = i.InjuryDate,
                ExpectedReturnDate = i.ExpectedReturnDate,
            })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var sessions = await _context.ScheduledSessions
            .Where(s => s.TeamId == player.TeamId && s.StartTime >= now)
            .OrderBy(s => s.StartTime).Take(5)
            .Select(s => new ChildSessionDto
            {
                Title = s.Title,
                SessionType = s.SessionType.ToString(),
                StartTime = s.StartTime,
                DurationMinutes = s.DurationMinutes,
                Location = s.Location,
            })
            .ToListAsync();

        var tasks = await _context.PlayerTasks
            .Where(t => t.PlayerId == playerId)
            .OrderBy(t => t.IsCompleted).ThenBy(t => t.DueDate)
            .Take(20)
            .Select(t => new ChildTaskDto
            {
                Title = t.Title,
                Category = t.Category.ToString(),
                Priority = t.Priority.ToString(),
                DueDate = t.DueDate,
                IsCompleted = t.IsCompleted,
            })
            .ToListAsync();

        var wellbeing = await _context.WellbeingCheckins
            .Where(w => w.PlayerId == playerId)
            .OrderByDescending(w => w.Date).Take(14)
            .ToListAsync();
        var wellbeingPoints = wellbeing
            .OrderBy(w => w.Date)
            .Select(w => new ChildWellbeingPointDto
            {
                Date = w.Date,
                Feeling = w.Feeling,
                Energy = w.Energy,
                Sleep = w.Sleep,
                HasPain = w.HasPain,
                Score = Math.Round((w.Feeling + w.Energy + w.Sleep) / 3.0 * 2.0, 1),
            })
            .ToList();

        return new ChildOverviewDto
        {
            PlayerId = player.Id,
            FullName = player.FullName,
            TeamName = player.Team?.Name,
            SportName = player.Sport?.Name,
            PositionName = player.Position?.Name,
            Age = player.Age,
            Height = player.Height,
            Weight = player.Weight,
            FitnessLevel = player.FitnessLevel,
            AverageScoreByCategory = byCategory,
            OverallAverage = allScores.Count > 0 ? Math.Round((double)allScores.Average(s => s.Score), 1) : null,
            LastAssessmentDate = assessments.Count > 0 ? assessments.Max(a => a.DateRecorded) : null,
            Injuries = injuries,
            UpcomingSessions = sessions,
            Tasks = tasks,
            Wellbeing = wellbeingPoints,
            WellbeingScore = wellbeingPoints.Count > 0 ? wellbeingPoints.Last().Score : null,
        };
    }

    // A parent may only read a player they're explicitly linked to.
    private async Task EnsureLinkedAsync(ClaimsPrincipal parent, int playerId)
    {
        var userId = _access.RequireUserId(parent);
        var linked = await _context.ParentLinks.AnyAsync(l => l.ParentUserId == userId && l.PlayerId == playerId);
        if (!linked)
            throw new ForbiddenApiException("You can only view your own child's profile.");
    }

    // URL-safe 32-byte token (same shape as password-reset tokens).
    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
    }
}
