namespace ProTracker.Models;

// A shareable code (also rendered as a QR code / join link on the frontend) that lets an
// athlete self-register into a coach's team. Only one code per team is active at a time —
// generating a new one deactivates the previous ones.
public class TeamJoinCode
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public string CoachId { get; set; } = "";

    // 8 chars, uppercase, unique (e.g. "CITY26KQ"). Compared case-insensitively by normalizing input.
    public string Code { get; set; } = "";

    // Reserved for a server-generated QR payload; the frontend currently renders the QR itself.
    public string? QRCodeData { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }   // null = never expires
    public int? MaxUses { get; set; }          // null = unlimited
    public int UseCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
