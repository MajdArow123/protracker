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

    /// <summary>
    /// The placeholder shipped in the committed appsettings.json. It is public by
    /// definition, so a deployment signing real tokens with it can be forged by anyone.
    /// </summary>
    public const string PlaceholderMarker = "DEV-ONLY-CHANGE-ME";

    /// <summary>HS256 needs a key of at least 256 bits; reject anything shorter outright.</summary>
    public const int MinKeyBytes = 32;

    /// <summary>
    /// Throws when <paramref name="isProduction"/> and the signing key is missing, still the
    /// committed placeholder, or too short for HS256. Pure and static so it is testable
    /// without a host. Production failing to boot is the intended outcome — it beats
    /// silently signing real tokens with a key that is published in a public repo.
    /// </summary>
    public static void EnsureProductionSigningKey(string? signingKey, bool isProduction)
    {
        if (!isProduction) return;

        var problem =
            string.IsNullOrWhiteSpace(signingKey) ? "is missing"
            : signingKey.Contains(PlaceholderMarker, StringComparison.Ordinal) ? "is still the committed DEV-ONLY placeholder"
            : System.Text.Encoding.UTF8.GetByteCount(signingKey) < MinKeyBytes ? $"is shorter than the {MinKeyBytes}-byte HS256 minimum"
            : null;

        if (problem is null) return;

        throw new InvalidOperationException(
            $"Jwt:SigningKey {problem}. Production refuses to start: tokens signed with a missing, " +
            "placeholder, or undersized key are forgeable by anyone. Set a strong random value via " +
            "the Jwt__SigningKey environment variable (e.g. `openssl rand -base64 48`).");
    }
}
