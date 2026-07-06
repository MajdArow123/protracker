namespace ProTracker.Models;

// A coach's email invitation for a specific athlete to join a team. The email carries the
// team's join link (pre-filled join code); this record only powers the "Pending Invites"
// list — enrollment itself always goes through the join-code registration flow.
public class AthleteInvite
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public string Email { get; set; } = "";
    public string InvitedByCoachId { get; set; } = "";

    // The join code that was embedded in the invite email.
    public string JoinCode { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    // Set when an athlete registers with this email via the team's join code.
    public DateTime? AcceptedAt { get; set; }
}
