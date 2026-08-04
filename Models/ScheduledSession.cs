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

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    // Exactly one of TeamId / PlayerId is set: team sessions are the coach flow,
    // player-scoped sessions belong to a solo athlete.
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public int? PlayerId { get; set; }
    public Player? Player { get; set; }

    public string Title { get; set; } = "";
    public SessionType SessionType { get; set; }

    public DateTime StartTime { get; set; }
    public int DurationMinutes { get; set; }

    public string? Location { get; set; }
    public string? Focus { get; set; }
    public string? Notes { get; set; }
}
