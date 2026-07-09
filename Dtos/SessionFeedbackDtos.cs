using ProTracker.Models;

namespace ProTracker.Dtos;

public class SubmitSessionFeedbackDto
{
    public int Rating { get; set; }
    public int EnergyBefore { get; set; }
    public int EnergyAfter { get; set; }
    public int Difficulty { get; set; }
    public string? WhatWentWell { get; set; }
    public string? WhatWasHard { get; set; }
    public string? InjuryNote { get; set; }
}

// One athlete's feedback (returned to coaches with player identity, and to the
// athlete for their own history).
public class SessionFeedbackDto
{
    public int Id { get; set; }
    public int ScheduledSessionId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int Rating { get; set; }
    public int EnergyBefore { get; set; }
    public int EnergyAfter { get; set; }
    public int Difficulty { get; set; }
    public string? WhatWentWell { get; set; }
    public string? WhatWasHard { get; set; }
    public string? InjuryNote { get; set; }
    public DateTime SubmittedAt { get; set; }

    // Session context (populated on player-history + mine responses).
    public string? SessionTitle { get; set; }
    public SessionType? SessionType { get; set; }
    public DateTime? SessionStartTime { get; set; }
}

// Coach view for one session: every response + a summary.
public class SessionFeedbackSummaryDto
{
    public int ScheduledSessionId { get; set; }
    public int RespondedCount { get; set; }
    public int TeamPlayerCount { get; set; }
    public double? AverageRating { get; set; }
    public double? AverageDifficulty { get; set; }
    public double? AverageEnergyBefore { get; set; }
    public double? AverageEnergyAfter { get; set; }
    public int InjuryFlagCount { get; set; }
    public List<SessionFeedbackDto> Responses { get; set; } = new();
}

// An athlete's past session with their own feedback attached (null = still to rate).
public class MySessionFeedbackDto
{
    public ScheduledSessionDto Session { get; set; } = null!;
    public SessionFeedbackDto? Feedback { get; set; }
}

// Analytics for the coach Schedule tab.
public class SessionFeedbackAnalyticsDto
{
    public int TotalResponses { get; set; }
    public double? OverallAverageRating { get; set; }
    public double? OverallAverageDifficulty { get; set; }
    public int InjuryFlagCount { get; set; }
    public List<RatedSessionPointDto> RatingTrend { get; set; } = new();
    public List<SessionTypeRatingDto> ByType { get; set; } = new();
}

public class RatedSessionPointDto
{
    public int ScheduledSessionId { get; set; }
    public string Title { get; set; } = "";
    public DateTime StartTime { get; set; }
    public SessionType SessionType { get; set; }
    public double AverageRating { get; set; }
    public double AverageDifficulty { get; set; }
    public int RespondedCount { get; set; }
    public int InjuryFlagCount { get; set; }
}

public class SessionTypeRatingDto
{
    public SessionType SessionType { get; set; }
    public double AverageRating { get; set; }
    public double AverageDifficulty { get; set; }
    public int ResponseCount { get; set; }
}
