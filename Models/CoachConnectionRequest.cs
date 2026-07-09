namespace ProTracker.Models;

public enum ConnectionRequestStatus
{
    Pending,
    Accepted,
    Declined,
    Withdrawn
}

// A connection request an athlete (or solo athlete) sends to a coach they found on the
// marketplace. Names/sport are denormalized for cheap display (same pattern as CoachNote).
public class CoachConnectionRequest
{
    public int Id { get; set; }

    // The coach being contacted (ApplicationUser id) + denormalized display name.
    public string CoachUserId { get; set; } = "";
    public string CoachName { get; set; } = "";

    // The requesting athlete (ApplicationUser id) + denormalized display name.
    public string AthleteUserId { get; set; } = "";
    public string AthleteName { get; set; } = "";

    // The athlete's player record, if any (nullable — kept for future use / team detection).
    public int? AthletePlayerId { get; set; }

    public string? Message { get; set; }

    // The sport the athlete plays (drives which team's join code is issued on accept).
    public int? SportId { get; set; }
    public string? SportName { get; set; }

    public ConnectionRequestStatus Status { get; set; } = ConnectionRequestStatus.Pending;

    // Coach's decline reason / internal note.
    public string? CoachNote { get; set; }

    // Set on accept when the athlete has no team: the join code they can use.
    public string? ResultJoinCode { get; set; }

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }
}
