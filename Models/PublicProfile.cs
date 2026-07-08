namespace ProTracker.Models;

// An athlete's opt-in public sharing settings. One row per player, addressed by a unique
// URL-safe slug (e.g. "lucas-ward-soccer"). Nothing is exposed publicly unless IsPublic is
// true, and each Show* flag independently gates a section. Private goals / private journal
// entries are never surfaced regardless of these flags.
public class PublicProfile
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // ApplicationUser Id of the owning athlete.
    public string? UserId { get; set; }

    // Unique, URL-safe. Generated from display name + sport at creation.
    public string Slug { get; set; } = "";

    // Editable overrides; default to the player's name / the user's bio.
    public string DisplayName { get; set; } = "";
    public string? Bio { get; set; }

    public bool IsPublic { get; set; }
    public bool ShowAssessments { get; set; } = true;
    public bool ShowGoals { get; set; } = true;
    public bool ShowJournal { get; set; }
    public bool ShowMatchHistory { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
