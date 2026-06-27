namespace ProTracker.Models;

// Opaque refresh tokens are stored hashed (never the raw token) so a DB leak alone
// doesn't let an attacker mint sessions. The raw token only ever lives in the HttpOnly cookie.
public class RefreshToken
{
    public int Id { get; set; }

    public string UserId { get; set; } = "";

    public string TokenHash { get; set; } = "";

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }

    // Set when this token was rotated out for a newer one, to detect reuse of a stale token.
    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive => RevokedAt == null && ExpiresAt > DateTime.UtcNow;
}
