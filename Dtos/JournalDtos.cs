using ProTracker.Models;

namespace ProTracker.Dtos;

public class JournalEntryDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public DateTime EntryDate { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public JournalMood Mood { get; set; }
    public int EnergyLevel { get; set; }
    public int? TrainingRating { get; set; }
    public string? KeyLearning { get; set; }
    public string? TomorrowFocus { get; set; }
    public string? Tags { get; set; }
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// Used both to upsert today's entry (POST /api/journal) and to update a specific one (PUT).
public class UpsertJournalEntryDto
{
    // Optional; defaults to today when omitted (only "today" may be created via POST).
    public DateTime? EntryDate { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = "";
    public JournalMood Mood { get; set; } = JournalMood.Okay;
    public int EnergyLevel { get; set; } = 3;
    public int? TrainingRating { get; set; }
    public string? KeyLearning { get; set; }
    public string? TomorrowFocus { get; set; }
    public string? Tags { get; set; }
    public bool IsPrivate { get; set; } = true;
}
