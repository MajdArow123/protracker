namespace ProTracker.Models;

// A daily self-reported wellbeing check-in by an athlete. One row per player per calendar
// day (upserted). Feeling/Energy/Sleep are 1-5 subjective scales; a separate pain flag lets
// the athlete report soreness/pain that — combined with an active injury or recovery plan —
// surfaces an alert to the coach.
public class WellbeingCheckin
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // Calendar date of the check-in (stored as UTC midnight). Uniquely identifies the
    // athlete's entry for that day together with PlayerId.
    public DateTime Date { get; set; }

    public int Feeling { get; set; } // 1-5
    public int Energy { get; set; }  // 1-5
    public int Sleep { get; set; }   // 1-5

    public bool HasPain { get; set; }
    public string? PainArea { get; set; }
    public string? PainNote { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
