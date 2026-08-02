using ProTracker.Auth;

namespace ProTracker.Tests;

// Pure unit tests for the production fail-fast guard on Jwt:SigningKey (no host, no database).
//
// Regression net for a real incident: production had no Jwt__SigningKey set, so it silently
// fell through to the DEV-ONLY placeholder committed in appsettings.json. Because that file
// is in a public repo, every production token was forgeable by anyone. Boot must now fail
// instead of signing real tokens with a published key.
public class JwtSigningKeyGuardTests
{
    private const string RealKey = "Zq8lF3vN2pR7wX1yT6kA9sD4gH0jL5mB8nC2vZ7xQ4e=";  // 44 chars > 32 bytes

    // ─── Production: must throw ──────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Production_throws_when_key_missing(string? key)
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => JwtSettings.EnsureProductionSigningKey(key, isProduction: true));
        Assert.Contains("is missing", ex.Message);
    }

    [Fact]
    public void Production_throws_on_the_committed_placeholder()
    {
        // The exact string shipped in appsettings.json.
        const string placeholder =
            "DEV-ONLY-CHANGE-ME-this-key-must-move-to-user-secrets-or-env-vars-before-any-real-deployment-32bytes+";

        var ex = Assert.Throws<InvalidOperationException>(
            () => JwtSettings.EnsureProductionSigningKey(placeholder, isProduction: true));
        Assert.Contains("placeholder", ex.Message);
    }

    [Fact]
    public void Production_throws_when_placeholder_marker_is_embedded_anywhere()
    {
        // Guards against "fixing" it by decorating the placeholder rather than replacing it.
        Assert.Throws<InvalidOperationException>(
            () => JwtSettings.EnsureProductionSigningKey("prefix-DEV-ONLY-CHANGE-ME-suffix-padding-to-32-bytes", isProduction: true));
    }

    [Fact]
    public void Production_throws_when_key_is_shorter_than_the_HS256_minimum()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => JwtSettings.EnsureProductionSigningKey(new string('k', JwtSettings.MinKeyBytes - 1), isProduction: true));
        Assert.Contains("minimum", ex.Message);
    }

    [Fact]
    public void Production_message_names_the_env_var_so_the_fix_is_obvious()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => JwtSettings.EnsureProductionSigningKey(null, isProduction: true));
        Assert.Contains("Jwt__SigningKey", ex.Message);
    }

    // ─── Production: must pass ───────────────────────────────────────────────

    [Fact]
    public void Production_accepts_a_strong_key()
    {
        JwtSettings.EnsureProductionSigningKey(RealKey, isProduction: true);
    }

    [Fact]
    public void Production_accepts_a_key_exactly_at_the_minimum_length()
    {
        JwtSettings.EnsureProductionSigningKey(new string('k', JwtSettings.MinKeyBytes), isProduction: true);
    }

    // ─── Non-production: never blocks local dev or the test rig ──────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("DEV-ONLY-CHANGE-ME-this-key-must-move-to-user-secrets-or-env-vars-before-any-real-deployment-32bytes+")]
    [InlineData("short")]
    public void Non_production_never_throws(string? key)
    {
        JwtSettings.EnsureProductionSigningKey(key, isProduction: false);
    }
}
