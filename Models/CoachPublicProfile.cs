namespace ProTracker.Models;

// A coach's opt-in public marketplace listing. One row per coach (ApplicationUser),
// addressed by a unique URL-safe slug (e.g. "coach-daniels-soccer"). Nothing is exposed
// on the marketplace unless IsPublic is true. DisplayName + profile picture are read from
// the owning ApplicationUser; the derived stats (team/player counts, avg score) are
// computed at query time and never stored.
public class CoachPublicProfile
{
    public int Id { get; set; }

    // ApplicationUser Id of the owning coach (unique).
    public string CoachUserId { get; set; } = "";

    // Unique, URL-safe. Generated from display name + primary sport at creation.
    public string Slug { get; set; } = "";

    public string? Bio { get; set; } // max 1000 chars, enforced in the service

    // Primary sport the coach markets themselves under (drives the sport filter).
    public int? SportId { get; set; }
    public Sport? Sport { get; set; }

    public string? City { get; set; }
    public string? Country { get; set; }
    public int? YearsCoaching { get; set; }

    public string? Certifications { get; set; }
    public string? Specialization { get; set; }

    public bool IsAcceptingAthletes { get; set; } = true;

    // Optional public-facing contact email (may differ from the account email).
    public string? ContactEmail { get; set; }

    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
