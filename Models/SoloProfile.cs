namespace ProTracker.Models;

public enum SkillLevel
{
    Beginner,
    Intermediate,
    Advanced,
    Elite
}

public enum TrainingFrequency
{
    Daily,
    FewTimesWeek,
    Weekly,
    Occasionally
}

// Extra self-description for a solo (coach-less) athlete. One per solo player; kept
// after the athlete connects to a coach (their solo history is still theirs).
public class SoloProfile
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // Duplicate of Player.UserId at creation time, kept for direct lookups.
    public string UserId { get; set; } = "";

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    public SkillLevel SkillLevel { get; set; } = SkillLevel.Intermediate;

    public string? Goals { get; set; }
    public string? Motivation { get; set; }

    public TrainingFrequency TrainingFrequency { get; set; } = TrainingFrequency.FewTimesWeek;

    // Reserved for future public profile sharing.
    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
