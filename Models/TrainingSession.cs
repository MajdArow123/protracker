namespace ProTracker.Models;

public enum AttendanceStatus
{
    Present,
    Absent,
    Late,
    Excused
}

public class TrainingSession
{
    public int Id { get; set; }

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public DateTime Date { get; set; }
    public int DurationMinutes { get; set; }
    public string? Notes { get; set; }

    public AttendanceStatus AttendanceStatus { get; set; }
}
