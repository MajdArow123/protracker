using ProTracker.Models;

namespace ProTracker.Dtos;

public class TeamAnnouncementDto
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public string CoachId { get; set; } = "";
    public string CoachName { get; set; } = "";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public AnnouncementPriority Priority { get; set; }
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateTeamAnnouncementDto
{
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public AnnouncementPriority Priority { get; set; } = AnnouncementPriority.Normal;
    public bool IsPinned { get; set; }
}
