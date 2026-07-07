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

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _tokenService;
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;
    private readonly IPushService _push;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IJwtTokenService tokenService,
        ApplicationDbContext context,
        IEmailService email,
        IConfiguration config,
        ILogger<AuthService> logger,
        IPushService push)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _context = context;
        _email = email;
        _config = config;
        _logger = logger;
        _push = push;
    }

    public async Task<(UserInfoDto User, string AccessToken, string RefreshToken)> RegisterAsync(RegisterRequest request)
    {
        var allowedRoles = new[] { "Coach", "Athlete" };
        var role = allowedRoles.Contains(request.Role) ? request.Role : "Athlete";

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName,
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            throw new ValidationApiException(string.Join("; ", result.Errors.Select(e => e.Description)));

        await _userManager.AddToRoleAsync(user, role);

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);
        var refreshToken = await _tokenService.CreateRefreshTokenAsync(user.Id);

        return (ToUserInfo(user, roles), accessToken, refreshToken);
    }

    // Athlete self-enrollment via a team join code: one call creates the account, the Player
    // record on the coach's team, and any dietary-restriction rows, then auto-logs-in.
    public async Task<RegisterAthleteResponse> RegisterAthleteAsync(RegisterAthleteRequest request)
    {
        var code = (request.Code ?? "").Trim().ToUpperInvariant();
        var joinCode = await _context.TeamJoinCodes
            .Include(c => c.Team)
            .FirstOrDefaultAsync(c => c.Code == code);

        if (joinCode == null || !joinCode.IsActive
            || (joinCode.ExpiresAt.HasValue && joinCode.ExpiresAt.Value < DateTime.UtcNow)
            || (joinCode.MaxUses.HasValue && joinCode.UseCount >= joinCode.MaxUses.Value))
            throw new ValidationApiException("This join code is invalid, expired, or no longer active. Ask your coach for a new one.");

        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ValidationApiException("A valid email is required.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ValidationApiException("Full name is required.");
        if (await _userManager.FindByEmailAsync(email) != null)
            throw new ValidationApiException("An account with this email already exists. Sign in instead.");

        var age = ComputeAge(request.DateOfBirth);
        if (age < 5 || age > 90)
            throw new ValidationApiException("Please enter a valid date of birth.");
        if (request.Height < 80 || request.Height > 250)
            throw new ValidationApiException("Height must be between 80 and 250 cm.");
        if (request.Weight < 20 || request.Weight > 250)
            throw new ValidationApiException("Weight must be between 20 and 250 kg.");
        if (request.JerseyNumber is < 0 or > 999)
            throw new ValidationApiException("Jersey number must be between 0 and 999.");

        var position = await _context.Positions.FirstOrDefaultAsync(p => p.Id == request.PositionId)
            ?? throw new ValidationApiException("Please choose a position.");
        if (position.SportId != joinCode.Team.SportId)
            throw new ValidationApiException("That position does not belong to this team's sport.");

        // Parse dietary restrictions up front so a bad payload fails before any writes.
        var restrictions = new List<PlayerNutritionProfile>();
        foreach (var r in request.DietaryRestrictions ?? new())
        {
            if (!Enum.TryParse<NutritionPreferenceType>(r.Type, true, out var type)
                || !Enum.TryParse<NutritionCategory>(r.Category, true, out var category)
                || !Enum.TryParse<NutritionSeverity>(r.Severity, true, out var severity))
                throw new ValidationApiException("One of the dietary restrictions is invalid.");
            restrictions.Add(new PlayerNutritionProfile
            {
                PreferenceType = type,
                Category = category,
                SpecificItem = string.IsNullOrWhiteSpace(r.SpecificItem) ? null : r.SpecificItem.Trim(),
                Severity = severity,
            });
        }

        await using var tx = await _context.Database.BeginTransactionAsync();

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = request.FullName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            EmergencyContactName = NullIfBlank(request.EmergencyContactName),
            EmergencyContactPhone = NullIfBlank(request.EmergencyContactPhone),
            EmergencyContactRelationship = NullIfBlank(request.EmergencyContactRelationship),
            // The join wizard collects everything onboarding would ask for — don't re-onboard.
            HasCompletedOnboarding = true,
        };
        var created = await _userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            throw new ValidationApiException(string.Join("; ", created.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, "Athlete");

        var player = new Player
        {
            FullName = request.FullName.Trim(),
            Age = age,
            DateOfBirth = request.DateOfBirth,
            Height = request.Height,
            Weight = request.Weight,
            SportId = joinCode.Team.SportId,
            TeamId = joinCode.TeamId,
            PositionId = request.PositionId,
            JerseyNumber = request.JerseyNumber,
            FitnessLevel = 5, // neutral default until the coach assesses
            Goals = NullIfBlank(request.Preferences),
            UserId = user.Id,
            JoinedViaCodeAt = DateTime.UtcNow,
        };
        _context.Players.Add(player);
        await _context.SaveChangesAsync();

        foreach (var r in restrictions)
        {
            r.PlayerId = player.Id;
            _context.PlayerNutritionProfiles.Add(r);
        }

        joinCode.UseCount++;

        // If the coach emailed this athlete an invite for this team, mark it accepted.
        var pendingInvites = await _context.AthleteInvites
            .Where(i => i.TeamId == joinCode.TeamId && i.Email == email && i.AcceptedAt == null)
            .ToListAsync();
        foreach (var inv in pendingInvites) inv.AcceptedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        // Fire-and-forget web push to the coach (in-app bell derives from JoinedViaCodeAt).
        _push.SendToUser(joinCode.Team.CoachId, new PushPayload
        {
            Title = "New athlete joined",
            Body = $"{player.FullName} joined {joinCode.Team.Name}",
            Url = $"/players/{player.Id}",
            Tag = $"athlete-joined-{player.Id}",
        });

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);
        var refreshToken = await _tokenService.CreateRefreshTokenAsync(user.Id);

        return new RegisterAthleteResponse
        {
            User = ToUserInfo(user, roles),
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            TeamName = joinCode.Team.Name,
            PlayerId = player.Id,
        };
    }

    // Solo athlete self-registration: account + team-less Player + SoloProfile + dietary
    // rows in one transaction, then auto-login. No join code, no coach.
    public async Task<RegisterSoloResponse> RegisterSoloAsync(RegisterSoloRequest request)
    {
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ValidationApiException("A valid email is required.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ValidationApiException("Full name is required.");
        if (await _userManager.FindByEmailAsync(email) != null)
            throw new ValidationApiException("An account with this email already exists. Sign in instead.");

        var age = ComputeAge(request.DateOfBirth);
        if (age < 5 || age > 90)
            throw new ValidationApiException("Please enter a valid date of birth.");
        if (request.Height < 80 || request.Height > 250)
            throw new ValidationApiException("Height must be between 80 and 250 cm.");
        if (request.Weight < 20 || request.Weight > 250)
            throw new ValidationApiException("Weight must be between 20 and 250 kg.");
        if (request.JerseyNumber is < 0 or > 999)
            throw new ValidationApiException("Jersey number must be between 0 and 999.");

        var sport = await _context.Sports.FirstOrDefaultAsync(s => s.Id == request.SportId)
            ?? throw new ValidationApiException("Please choose a sport.");
        var position = await _context.Positions.FirstOrDefaultAsync(p => p.Id == request.PositionId)
            ?? throw new ValidationApiException("Please choose a position.");
        if (position.SportId != sport.Id)
            throw new ValidationApiException("That position does not belong to the chosen sport.");

        if (!Enum.TryParse<SkillLevel>(request.SkillLevel, true, out var skillLevel))
            throw new ValidationApiException("Please choose a skill level.");
        if (!Enum.TryParse<TrainingFrequency>(request.TrainingFrequency, true, out var frequency))
            throw new ValidationApiException("Please choose a training frequency.");

        // Parse dietary restrictions up front so a bad payload fails before any writes.
        var restrictions = new List<PlayerNutritionProfile>();
        foreach (var r in request.DietaryRestrictions ?? new())
        {
            if (!Enum.TryParse<NutritionPreferenceType>(r.Type, true, out var type)
                || !Enum.TryParse<NutritionCategory>(r.Category, true, out var category)
                || !Enum.TryParse<NutritionSeverity>(r.Severity, true, out var severity))
                throw new ValidationApiException("One of the dietary restrictions is invalid.");
            restrictions.Add(new PlayerNutritionProfile
            {
                PreferenceType = type,
                Category = category,
                SpecificItem = string.IsNullOrWhiteSpace(r.SpecificItem) ? null : r.SpecificItem.Trim(),
                Severity = severity,
            });
        }

        await using var tx = await _context.Database.BeginTransactionAsync();

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            DisplayName = request.FullName.Trim(),
            PhoneNumber = NullIfBlank(request.Phone),
            EmergencyContactName = NullIfBlank(request.EmergencyContactName),
            EmergencyContactPhone = NullIfBlank(request.EmergencyContactPhone),
            EmergencyContactRelationship = NullIfBlank(request.EmergencyContactRelationship),
            // The solo wizard collects everything onboarding would ask for — don't re-onboard.
            HasCompletedOnboarding = true,
        };
        var created = await _userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
            throw new ValidationApiException(string.Join("; ", created.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, "SoloAthlete");

        var player = new Player
        {
            FullName = request.FullName.Trim(),
            Age = age,
            DateOfBirth = request.DateOfBirth,
            Height = request.Height,
            Weight = request.Weight,
            SportId = sport.Id,
            TeamId = null,
            PositionId = position.Id,
            JerseyNumber = request.JerseyNumber,
            FitnessLevel = 5, // neutral default until assessments say otherwise
            Goals = NullIfBlank(request.Goals),
            UserId = user.Id,
            IsSolo = true,
            SoloUserId = user.Id,
        };
        _context.Players.Add(player);
        await _context.SaveChangesAsync();

        _context.SoloProfiles.Add(new SoloProfile
        {
            PlayerId = player.Id,
            UserId = user.Id,
            SportId = sport.Id,
            SkillLevel = skillLevel,
            TrainingFrequency = frequency,
            Goals = NullIfBlank(request.Goals),
            Motivation = NullIfBlank(request.Motivation),
            CreatedAt = DateTime.UtcNow,
        });

        foreach (var r in restrictions)
        {
            r.PlayerId = player.Id;
            _context.PlayerNutritionProfiles.Add(r);
        }

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);
        var refreshToken = await _tokenService.CreateRefreshTokenAsync(user.Id);

        return new RegisterSoloResponse
        {
            User = ToUserInfo(user, roles),
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            PlayerId = player.Id,
            SportName = sport.Name,
        };
    }

    // A solo athlete joins a coach's team via a join code. Their player record (and every
    // FK hanging off it — assessments, plans, tasks, matches…) is preserved; only the
    // team link and role change. Fresh tokens are returned because the role is in the JWT.
    public async Task<ConnectCoachResponse> ConnectCoachAsync(ClaimsPrincipal principal, ConnectCoachRequest request)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedApiException();
        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new UnauthorizedApiException();

        var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == userId && p.IsSolo)
            ?? throw new ValidationApiException("No solo player record is linked to your account.");
        if (player.TeamId != null)
            throw new ValidationApiException("You are already on a team.");

        var code = (request.Code ?? "").Trim().ToUpperInvariant();
        var joinCode = await _context.TeamJoinCodes
            .Include(c => c.Team)
            .FirstOrDefaultAsync(c => c.Code == code);
        if (joinCode == null || !joinCode.IsActive
            || (joinCode.ExpiresAt.HasValue && joinCode.ExpiresAt.Value < DateTime.UtcNow)
            || (joinCode.MaxUses.HasValue && joinCode.UseCount >= joinCode.MaxUses.Value))
            throw new ValidationApiException("This join code is invalid, expired, or no longer active. Ask the coach for a new one.");

        if (joinCode.Team.SportId != player.SportId)
            throw new ValidationApiException("This team plays a different sport than your solo profile. You can only join a team in your own sport.");

        await using var tx = await _context.Database.BeginTransactionAsync();

        player.TeamId = joinCode.TeamId;
        player.IsSolo = false;
        player.JoinedViaCodeAt = DateTime.UtcNow;
        joinCode.UseCount++;

        // If the coach emailed this athlete an invite for this team, mark it accepted.
        var email = (user.Email ?? "").ToLowerInvariant();
        var pendingInvites = await _context.AthleteInvites
            .Where(i => i.TeamId == joinCode.TeamId && i.Email == email && i.AcceptedAt == null)
            .ToListAsync();
        foreach (var inv in pendingInvites) inv.AcceptedAt = DateTime.UtcNow;

        // Hand the athlete's self-assigned tasks to the coach: the coach task board only
        // shows tasks the coach owns, and the (now managed) athlete keeps seeing them via
        // their player-scoped "my tasks" view either way.
        var selfTasks = await _context.PlayerTasks
            .Where(t => t.PlayerId == player.Id && t.CoachId == userId)
            .ToListAsync();
        foreach (var t in selfTasks) t.CoachId = joinCode.Team.CoachId;

        await _context.SaveChangesAsync();

        // Swap the role: they're now a coach-managed athlete.
        await _userManager.RemoveFromRoleAsync(user, "SoloAthlete");
        if (!await _userManager.IsInRoleAsync(user, "Athlete"))
            await _userManager.AddToRoleAsync(user, "Athlete");

        await tx.CommitAsync();

        _push.SendToUser(joinCode.Team.CoachId, new PushPayload
        {
            Title = "New athlete joined",
            Body = $"{player.FullName} joined {joinCode.Team.Name}",
            Url = $"/players/{player.Id}",
            Tag = $"athlete-joined-{player.Id}",
        });

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);
        var refreshToken = await _tokenService.CreateRefreshTokenAsync(user.Id);

        return new ConnectCoachResponse
        {
            User = ToUserInfo(user, roles),
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            TeamName = joinCode.Team.Name,
            TeamId = joinCode.TeamId,
            PlayerId = player.Id,
        };
    }

    private static int ComputeAge(DateTime dateOfBirth)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public async Task<(UserInfoDto User, string AccessToken, string RefreshToken)> LoginAsync(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null || !await _userManager.CheckPasswordAsync(user, request.Password))
            throw new UnauthorizedApiException("Invalid email or password.");

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);
        var refreshToken = await _tokenService.CreateRefreshTokenAsync(user.Id);

        return (ToUserInfo(user, roles), accessToken, refreshToken);
    }

    public async Task LogoutAsync(string? rawRefreshToken)
    {
        if (!string.IsNullOrEmpty(rawRefreshToken))
            await _tokenService.RevokeRefreshTokenAsync(rawRefreshToken);
    }

    public async Task<(string AccessToken, string RefreshToken)> RefreshAsync(string? rawRefreshToken)
    {
        if (string.IsNullOrEmpty(rawRefreshToken))
            throw new UnauthorizedApiException("Missing refresh token.");

        var rotated = await _tokenService.ValidateAndRotateRefreshTokenAsync(rawRefreshToken);
        if (rotated == null)
            throw new UnauthorizedApiException("Refresh token is invalid or expired.");

        var user = await _userManager.FindByIdAsync(rotated.Value.UserId);
        if (user == null)
            throw new UnauthorizedApiException("User no longer exists.");

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.CreateAccessToken(user, roles);

        return (accessToken, rotated.Value.NewRawRefreshToken);
    }

    public async Task<UserInfoDto> GetCurrentUserAsync(ClaimsPrincipal principal)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedApiException();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            throw new UnauthorizedApiException();

        var roles = await _userManager.GetRolesAsync(user);
        return ToUserInfo(user, roles);
    }

    // ─── Password reset ──────────────────────────────────────────────────────

    public async Task ForgotPasswordAsync(string email)
    {
        var user = await _userManager.FindByEmailAsync(email.Trim());
        // Don't reveal whether the email exists — callers always get a generic success.
        if (user == null)
        {
            _logger.LogInformation("[PasswordReset] Forgot-password requested for unknown email.");
            return;
        }

        // Rate limit: at most 3 tokens per user per hour.
        var since = DateTime.UtcNow.AddHours(-1);
        var recent = await _context.PasswordResetTokens.CountAsync(t => t.UserId == user.Id && t.CreatedAt >= since);
        if (recent >= 3)
        {
            _logger.LogWarning("[PasswordReset] Rate limit hit for user {UserId}; not sending.", user.Id);
            return;
        }

        var token = GenerateToken();
        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();

        var frontendUrl = (_config["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');
        var resetUrl = $"{frontendUrl}/reset-password?token={token}";
        await _email.SendPasswordResetAsync(user.Email!, resetUrl);
    }

    public async Task<ValidateResetTokenResponse> ValidateResetTokenAsync(string token)
    {
        var entry = await _context.PasswordResetTokens.FirstOrDefaultAsync(t => t.Token == token);
        if (entry == null || entry.IsUsed || entry.ExpiresAt <= DateTime.UtcNow)
            return new ValidateResetTokenResponse { Valid = false };

        var user = await _userManager.FindByIdAsync(entry.UserId);
        if (user == null) return new ValidateResetTokenResponse { Valid = false };

        return new ValidateResetTokenResponse { Valid = true, Email = user.Email };
    }

    public async Task ResetPasswordAsync(string token, string newPassword)
    {
        var entry = await _context.PasswordResetTokens.FirstOrDefaultAsync(t => t.Token == token);
        if (entry == null || entry.IsUsed || entry.ExpiresAt <= DateTime.UtcNow)
            throw new ValidationApiException("This password reset link is invalid or has expired.");

        var user = await _userManager.FindByIdAsync(entry.UserId)
            ?? throw new ValidationApiException("This password reset link is invalid or has expired.");

        // Validate BEFORE mutating the password (RemovePassword+AddPassword isn't atomic).
        ValidatePassword(newPassword);

        await _userManager.RemovePasswordAsync(user);
        var addResult = await _userManager.AddPasswordAsync(user, newPassword);
        if (!addResult.Succeeded)
            throw new ValidationApiException(string.Join("; ", addResult.Errors.Select(e => e.Description)));

        // Mark this token used and invalidate every other outstanding token for the user.
        entry.IsUsed = true;
        var siblings = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.Id != entry.Id && !t.IsUsed)
            .ToListAsync();
        foreach (var s in siblings) s.IsUsed = true;
        await _context.SaveChangesAsync();

        _logger.LogInformation("[PasswordReset] Password reset for user {UserId}.", user.Id);
    }

    // URL-safe Base64 of 32 cryptographic random bytes.
    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    // Registration-consistent rules (see Identity password options in Program.cs):
    // min 8 chars, at least one uppercase and one digit.
    private static void ValidatePassword(string pw)
    {
        var errors = new List<string>();
        if (pw is null || pw.Length < 8) errors.Add("Password must be at least 8 characters.");
        if (pw is null || !pw.Any(char.IsUpper)) errors.Add("Password must contain an uppercase letter.");
        if (pw is null || !pw.Any(char.IsDigit)) errors.Add("Password must contain a number.");
        if (errors.Count > 0) throw new ValidationApiException(errors);
    }

    private static UserInfoDto ToUserInfo(ApplicationUser user, IList<string> roles) => new()
    {
        Id = user.Id,
        Email = user.Email ?? "",
        DisplayName = user.DisplayName,
        Roles = roles.ToList()
    };
}
