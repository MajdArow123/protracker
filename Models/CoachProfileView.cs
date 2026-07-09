namespace ProTracker.Models;

// A view of a coach's public profile. Deduplicated per viewer (hashed IP) per day so the
// counts approximate unique daily visitors rather than raw hits.
public class CoachProfileView
{
    public int Id { get; set; }

    public string CoachUserId { get; set; } = "";

    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

    // SHA-256 of the client IP (privacy — the raw IP is never stored).
    public string? ViewerIpHash { get; set; }

    // Set when the viewer is logged in.
    public string? ViewerUserId { get; set; }

    // "marketplace" | "direct" | "landing" (best-effort, from a query param).
    public string? Source { get; set; }
}
