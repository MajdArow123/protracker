namespace ProTracker.Models;

public enum SessionType
{
    Training,
    MatchPrep,
    Recovery,
    Strength,
    Tactical,
    Other
}

// A team-scheduled session on the calendar (distinct from the per-player,
// attendance-based TrainingSession record). Coaches plan these; every athlete
// on the team sees them on their upcoming schedule.
public class ScheduledSession
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public string Title { get; set; } = "";
    public SessionType SessionType { get; set; }

    public DateTime StartTime { get; set; }
    public int DurationMinutes { get; set; }

    public string? Location { get; set; }
    public string? Focus { get; set; }
    public string? Notes { get; set; }
}
