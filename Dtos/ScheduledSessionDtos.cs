using ProTracker.Models;

namespace ProTracker.Dtos;

public class ScheduledSessionDto
{
    public int Id { get; set; }
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
    public int DurationMinutes { get; set; }
    public string? Location { get; set; }
    public string? Focus { get; set; }
    public string? Notes { get; set; }
}
