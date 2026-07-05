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

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IJwtTokenService tokenService,
        ApplicationDbContext context,
        IEmailService email,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _context = context;
        _email = email;
        _config = config;
        _logger = logger;
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
