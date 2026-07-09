namespace ProTracker.Models;

public enum AthleteNoteCategory
{
    Training,
    Nutrition,
    Mental,
    Personal,
    Goal,
    Other
}

// A completely private note written by an athlete (or solo athlete). Coaches can NEVER
// read these — the controller is Athlete/SoloAthlete-only and the service scopes every
// query to the caller's own player + user id.
public class AthleteNote
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // ApplicationUser Id of the author (redundant with the player's UserId, but makes the
    // ownership check explicit and cheap).
    public string UserId { get; set; } = "";

    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public AthleteNoteCategory Category { get; set; } = AthleteNoteCategory.Personal;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
