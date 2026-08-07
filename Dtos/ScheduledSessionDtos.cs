using ProTracker.Models;

namespace ProTracker.Dtos;

public class ScheduledSessionDto
{
    public int Id { get; set; }
    // Set only on a CREATE/UPDATE response when season resolution was Ambiguous, or
    // when a date-changing update unstamped a previously stamped record — a
    // non-blocking nudge (Phase 10 S3/S3+); null on reads and on clean resolutions.
    public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    // Null for a solo athlete's personal session.
    public int? TeamId { get; set; }
    public int? PlayerId { get; set; }
    public string TeamName { get; set; } = "";
    public string Title { get; set; } = "";
    public SessionType SessionType { get; set; }
    public DateTime StartTime { get; set; }
    public int DurationMinutes { get; set; }
    public string? Location { get; set; }
    public string? Focus { get; set; }
    public string? Notes { get; set; }
}

public class CreateScheduledSessionDto
{
    public string Title { get; set; } = "";
    public SessionType SessionType { get; set; }
    public DateTime StartTime { get; set; }
    // The client's LOCAL calendar date of StartTime (yyyy-MM-dd) — drives season
    // resolution (S2.2 ruling: never derive it from the UTC instant). Falls back to
    // StartTime's UTC date part when absent; must be within ±1 day of it.
    public string? LocalDate { get; set; }
    public int DurationMinutes { get; set; }
    public string? Location { get; set; }
    public string? Focus { get; set; }
    public string? Notes { get; set; }
}
