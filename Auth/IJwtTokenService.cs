using System.Security.Claims;
using ProTracker.Models;

namespace ProTracker.Auth;

public interface IJwtTokenService
{
    string CreateAccessToken(ApplicationUser user, IList<string> roles);

    // Returns the raw refresh token (to put in the cookie) — the DB only stores its hash.
    Task<string> CreateRefreshTokenAsync(string userId);

    // Validates the raw refresh token against the stored hash, rotates it, and returns the
    // owning userId, or null if the token is missing/expired/revoked/reused.
    Task<(string UserId, string NewRawRefreshToken)?> ValidateAndRotateRefreshTokenAsync(string rawToken);

    Task RevokeRefreshTokenAsync(string rawToken);

    ClaimsPrincipal? ValidateAccessToken(string token);
}
