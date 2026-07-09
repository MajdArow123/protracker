using ProTracker.Models;

namespace ProTracker.Dtos;

public class SendConnectionRequestDto
{
    public string? Message { get; set; }
    // Optional: the sport the athlete plays. Falls back to the athlete's player sport.
    public int? Sport { get; set; }
}

public class DeclineConnectionRequestDto
{
    public string? Reason { get; set; }
}

// Coach's view of an incoming request (+ athlete identity).
public class ConnectionRequestDto
{
    public int Id { get; set; }
    public string CoachUserId { get; set; } = "";
    public string CoachName { get; set; } = "";
    public string AthleteUserId { get; set; } = "";
    public string AthleteName { get; set; } = "";
    public int? AthletePlayerId { get; set; }
    public string? Message { get; set; }
    public int? SportId { get; set; }
    public string? SportName { get; set; }
    public ConnectionRequestStatus Status { get; set; }
    public string? CoachNote { get; set; }
    public string? ResultJoinCode { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}

// The athlete's view of a request they sent (+ the coach's public slug for linking back).
public class MyConnectionRequestDto
{
    public int Id { get; set; }
    public string CoachName { get; set; } = "";
    public string? CoachSlug { get; set; }
    public string? Message { get; set; }
    public string? SportName { get; set; }
    public ConnectionRequestStatus Status { get; set; }
    public string? ResultJoinCode { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
