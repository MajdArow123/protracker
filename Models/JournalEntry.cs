namespace ProTracker.Models;

public enum JournalMood
{
    Great,
    Good,
    Okay,
    Tough,
    Rough
}

// A daily reflective journal entry written by an athlete (or solo athlete). One row per
// player per calendar day (upserted). Private by default — coaches only ever see entries
// the athlete explicitly shares (IsPrivate == false).
public class JournalEntry
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // ApplicationUser Id of the athlete who owns this entry.
    public string? UserId { get; set; }

    // Calendar date the entry is for (stored as UTC midnight). Unique per player+date.
    public DateTime EntryDate { get; set; }

    // Optional; the UI auto-titles from the mood/date when left blank.
    public string? Title { get; set; }

    public string Content { get; set; } = "";

    public JournalMood Mood { get; set; } = JournalMood.Okay;

    public int EnergyLevel { get; set; } // 1-5
    public int? TrainingRating { get; set; } // 1-5, optional

    public string? KeyLearning { get; set; }
    public string? TomorrowFocus { get; set; }

    // Comma-separated free-text tags, e.g. "passing,fitness".
    public string? Tags { get; set; }

    public bool IsPrivate { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
