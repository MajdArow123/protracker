using ProTracker.Models;

namespace ProTracker.Dtos;

public class AthleteNoteDto
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public AthleteNoteCategory Category { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpsertAthleteNoteDto
{
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public AthleteNoteCategory Category { get; set; } = AthleteNoteCategory.Personal;
}
