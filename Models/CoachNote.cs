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

// A private, coach-only note about a player. NEVER exposed on any athlete-accessible
// endpoint — access is restricted to coaches with scope on the player's team.
// Distinct from the single free-text Player.CoachNotes field: this is a timestamped
// timeline of individual notes.
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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
