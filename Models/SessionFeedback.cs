namespace ProTracker.Models;

// An athlete's feedback on a (past) scheduled session. One row per player per session
// (unique index on ScheduledSessionId + PlayerId), upserted when re-submitted.
public class SessionFeedback
{
    public int Id { get; set; }

    public int ScheduledSessionId { get; set; }
    public ScheduledSession ScheduledSession { get; set; } = null!;

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int Rating { get; set; }        // 1-5 overall
    public int EnergyBefore { get; set; }  // 1-5
    public int EnergyAfter { get; set; }   // 1-5
    public int Difficulty { get; set; }    // 1-5

    public string? WhatWentWell { get; set; }
    public string? WhatWasHard { get; set; }
    public string? InjuryNote { get; set; } // any pain / injury the athlete flagged

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}
