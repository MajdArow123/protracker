using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Auth;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class AuthController : ApiControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult> Login(LoginRequest request)
    {
        var (user, accessToken, refreshToken) = await _authService.LoginAsync(request);
        WriteAuthCookies(accessToken, refreshToken);
        return Success(new LoginResponse { User = user });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult> Logout()
    {
        Request.Cookies.TryGetValue(JwtSettings.RefreshTokenCookieName, out var refreshToken);
        await _authService.LogoutAsync(refreshToken);
        ClearAuthCookies();
        return Success<object?>(null);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult> Refresh()
    {
        Request.Cookies.TryGetValue(JwtSettings.RefreshTokenCookieName, out var refreshToken);
        var (accessToken, newRefreshToken) = await _authService.RefreshAsync(refreshToken);
        WriteAuthCookies(accessToken, newRefreshToken);
        return Success<object?>(null);
    }

    // Inherits [Authorize(AuthenticationSchemes = Bearer)] from ApiControllerBase.
    [HttpGet("me")]
    public async Task<ActionResult> Me()
    {
        var user = await _authService.GetCurrentUserAsync(User);
        return Success(user);
    }

    private void WriteAuthCookies(string accessToken, string refreshToken)
    {
        var isDev = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDev,
            SameSite = isDev ? SameSiteMode.Strict : SameSiteMode.None,
            Path = "/"
        };

        Response.Cookies.Append(JwtSettings.AccessTokenCookieName, accessToken, cookieOptions);
        Response.Cookies.Append(JwtSettings.RefreshTokenCookieName, refreshToken, cookieOptions);
    }

    private void ClearAuthCookies()
    {
        Response.Cookies.Delete(JwtSettings.AccessTokenCookieName);
        Response.Cookies.Delete(JwtSettings.RefreshTokenCookieName);
    }
}
