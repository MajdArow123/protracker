using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum AnnouncementPriority
{
    Normal,
    Important,
    Urgent
}

// A coach announcement to a whole team. Every athlete on the team can read it;
// only coaches with scope on the team may create/edit/delete.
public class TeamAnnouncement
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    // ApplicationUser Id (string) of the coach who posted it.
    public string CoachId { get; set; } = "";
    public string CoachName { get; set; } = "";

    [Required]
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";

    public AnnouncementPriority Priority { get; set; } = AnnouncementPriority.Normal;
    public bool IsPinned { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
