namespace ProTracker.Models;

public class PlayerAssessment
{
    public int Id { get; set; }

    // Phase 10 season scoping (S1b): additive only — nothing reads or writes this yet.
    // Populated by the S2 write-resolver; null on every pre-existing row.
    public int? SeasonId { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int AssessmentPeriodId { get; set; }
    public AssessmentPeriod AssessmentPeriod { get; set; } = null!;

    public DateTime DateRecorded { get; set; }
    public string? Notes { get; set; }

    public List<PlayerStatScore> StatScores { get; set; } = new();
}
