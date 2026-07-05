namespace ProTracker.Models;

// A single-use, time-limited token emailed to a user so they can reset a forgotten
// password. Distinct from Identity's own reset tokens — we store ours so we can validate
// (for the reset form), enforce a per-user rate limit, and invalidate siblings on use.
public class PasswordResetToken
{
    public int Id { get; set; }

    // ApplicationUser.Id (string).
    public string UserId { get; set; } = "";

    // URL-safe random token (Base64Url of 32 cryptographic random bytes).
    public string Token { get; set; } = "";

    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
