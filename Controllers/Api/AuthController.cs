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

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult> Register(RegisterRequest request)
    {
        var (user, accessToken, refreshToken) = await _authService.RegisterAsync(request);
        WriteAuthCookies(accessToken, refreshToken);
        return Success(new LoginResponse { User = user, AccessToken = accessToken, RefreshToken = refreshToken });
    }

    // Athlete self-enrollment via a team join code — creates account + player record,
    // then behaves exactly like a successful login (cookies + tokens).
    [HttpPost("register-athlete")]
    [AllowAnonymous]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("join-validate")]
    public async Task<ActionResult> RegisterAthlete(RegisterAthleteRequest request)
    {
        var result = await _authService.RegisterAthleteAsync(request);
        WriteAuthCookies(result.AccessToken, result.RefreshToken);
        return Success(result);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult> Login(LoginRequest request)
    {
        var (user, accessToken, refreshToken) = await _authService.LoginAsync(request);
        WriteAuthCookies(accessToken, refreshToken);
        return Success(new LoginResponse { User = user, AccessToken = accessToken, RefreshToken = refreshToken });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult> Logout([FromBody] RefreshRequest? body = null)
    {
        // Accept refresh token from body (cross-domain) or cookie (same-domain)
        var refreshToken = body?.RefreshToken;
        if (string.IsNullOrEmpty(refreshToken))
            Request.Cookies.TryGetValue(JwtSettings.RefreshTokenCookieName, out refreshToken);
        await _authService.LogoutAsync(refreshToken);
        ClearAuthCookies();
        return Success<object?>(null);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult> Refresh([FromBody] RefreshRequest? body = null)
    {
        // Accept refresh token from body (cross-domain) or cookie (same-domain)
        var refreshToken = body?.RefreshToken;
        if (string.IsNullOrEmpty(refreshToken))
            Request.Cookies.TryGetValue(JwtSettings.RefreshTokenCookieName, out refreshToken);
        var (accessToken, newRefreshToken) = await _authService.RefreshAsync(refreshToken);
        WriteAuthCookies(accessToken, newRefreshToken);
        return Success(new TokenResponse { AccessToken = accessToken, RefreshToken = newRefreshToken });
    }

    // Inherits [Authorize(AuthenticationSchemes = Bearer)] from ApiControllerBase.
    [HttpGet("me")]
    public async Task<ActionResult> Me()
    {
        var user = await _authService.GetCurrentUserAsync(User);
        return Success(user);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        await _authService.ForgotPasswordAsync(request.Email);
        // Always the same response, regardless of whether the email exists (no enumeration).
        return Success(new GenericMessageResponse { Message = "If that email exists, a reset link has been sent." });
    }

    [HttpGet("validate-reset-token")]
    [AllowAnonymous]
    public async Task<ActionResult> ValidateResetToken([FromQuery] string token)
    {
        return Success(await _authService.ValidateResetTokenAsync(token ?? ""));
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ResetPassword(ResetPasswordRequest request)
    {
        await _authService.ResetPasswordAsync(request.Token, request.NewPassword);
        return Success(new GenericMessageResponse { Message = "Password reset successfully." });
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
