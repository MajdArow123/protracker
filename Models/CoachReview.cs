namespace ProTracker.Models;

// A review an athlete leaves on a coach's public profile. One row per reviewer per coach.
// IsVerified is set when the reviewer is (or was) a player on one of the coach's teams.
public class CoachReview
{
    public int Id { get; set; }

    public string CoachUserId { get; set; } = "";
    public string ReviewerUserId { get; set; } = "";
    // Denormalized reviewer display name at write time.
    public string ReviewerName { get; set; } = "";

    public int Rating { get; set; } // 1-5

    public string? Title { get; set; }   // max 100
    public string? Content { get; set; } // max 1000

    // The sport they trained together.
    public int? SportId { get; set; }
    public string? SportName { get; set; }

    public bool IsVerified { get; set; }
    public bool IsPublic { get; set; } = true;

    public string? CoachResponse { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
