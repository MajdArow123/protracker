using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using ProTracker.Auth;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _tokenService;

    public AuthService(UserManager<ApplicationUser> userManager, IJwtTokenService tokenService)
    {
        _userManager = userManager;
        _tokenService = tokenService;
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

    private static UserInfoDto ToUserInfo(ApplicationUser user, IList<string> roles) => new()
    {
        Id = user.Id,
        Email = user.Email ?? "",
        DisplayName = user.DisplayName,
        Roles = roles.ToList()
    };
}
