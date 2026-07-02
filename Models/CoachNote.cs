using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum CoachNoteCategory
{
    General,
    Performance,
    Attitude,
    Development,
    Tactical,
    Medical
}

// A coach note about a player. Private by default (coach-only); when IsPrivate is
// false the note is *shared* and the athlete can read it too. Distinct from the single
// free-text Player.CoachNotes field: this is a timestamped timeline of individual notes.
public class CoachNote
{
    public int Id { get; set; }

    // ApplicationUser Id (string) of the coach who authored the note.
    public string CoachId { get; set; } = "";
    public string CoachName { get; set; } = "";

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    [Required]
    public string Content { get; set; } = "";

    public CoachNoteCategory Category { get; set; } = CoachNoteCategory.General;

    // true = only the coach sees it; false = shared with the athlete too.
    public bool IsPrivate { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
