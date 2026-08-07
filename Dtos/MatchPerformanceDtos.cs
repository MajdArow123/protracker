namespace ProTracker.Dtos;

public class MatchPerformanceDto
{
    public int Id { get; set; }
    // Set only on a CREATE/UPDATE response when season resolution was Ambiguous, or
    // when a date-changing update unstamped a previously stamped record — a
    // non-blocking nudge (Phase 10 S3/S3+); null on reads and on clean resolutions.
    public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    public int PlayerId { get; set; }
    public DateTime MatchDate { get; set; }
    public string Opponent { get; set; } = "";
    public int PerformanceRating { get; set; }
    public string? Notes { get; set; }
    public string? SportSpecificStats { get; set; }
}

public class CreateMatchPerformanceDto
{
    public int PlayerId { get; set; }
    public DateTime MatchDate { get; set; }
    public string Opponent { get; set; } = "";
    public int PerformanceRating { get; set; }
    public string? Notes { get; set; }
    public string? SportSpecificStats { get; set; }
}
