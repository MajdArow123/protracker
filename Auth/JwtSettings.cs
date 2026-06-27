namespace ProTracker.Auth;

public class JwtSettings
{
    public string Issuer { get; set; } = "ProTracker";
    public string Audience { get; set; } = "ProTrackerClient";

    // Dev-only convenience default. Production deployments must override this via
    // user-secrets/environment variables — see Phase 3 risk notes.
    public string SigningKey { get; set; } = "";

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;

    public const string AccessTokenCookieName = "pt_access_token";
    public const string RefreshTokenCookieName = "pt_refresh_token";
}
