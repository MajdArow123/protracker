using ProTracker.Models;

namespace ProTracker.Dtos;

public class CoachNoteDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string CoachId { get; set; } = "";
    public string CoachName { get; set; } = "";
    public string Content { get; set; } = "";
    public CoachNoteCategory Category { get; set; }
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateCoachNoteDto
{
    public string Content { get; set; } = "";
    public CoachNoteCategory Category { get; set; } = CoachNoteCategory.General;
    public bool IsPrivate { get; set; } = true;
}
