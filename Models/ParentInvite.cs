namespace ProTracker.Models;

// A coach's invitation for a parent to get read-only access to a specific player. The parent
// follows the emailed link, sets a password, and an account + ParentLink are created. Mirrors
// the PasswordResetToken flow (URL-safe token, expiry, single-use).
public class ParentInvite
{
    public int Id { get; set; }

    public string Token { get; set; } = "";

    public string Email { get; set; } = "";
    public string ParentName { get; set; } = "";

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public string InvitedByCoachId { get; set; } = "";

    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
