namespace ProTracker.Dtos;

public class MatchPerformanceDto
{
    public int Id { get; set; }
    // Set only on a CREATE response when season resolution was Ambiguous — a
    // non-blocking nudge (Phase 10 S3); null on reads and on clean resolutions.
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
