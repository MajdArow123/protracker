namespace ProTracker.Dtos;

// --- Coach: inviting & listing parents ---

public class CreateParentInviteDto
{
    public int PlayerId { get; set; }
    public string Email { get; set; } = "";
    public string ParentName { get; set; } = "";
}

// Returned to the coach after creating an invite. InviteUrl is included so it can be shown/
// copied in-app when no email provider is configured (mirrors the password-reset fallback).
public class ParentInviteResultDto
{
    public string Email { get; set; } = "";
    public string ParentName { get; set; } = "";
    public string InviteUrl { get; set; } = "";
    public bool EmailSent { get; set; }
}

// A parent's relationship to a player, from the coach's side. Status is Active (accepted) or
// Pending (invite sent, not yet accepted).
public class PlayerParentDto
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

// --- Parent: accepting an invite ---

public class ParentInviteInfoDto
{
    public bool Valid { get; set; }
    public string Email { get; set; } = "";
    public string ParentName { get; set; } = "";
    public string PlayerName { get; set; } = "";
    public string CoachName { get; set; } = "";
    // True when the email already has a ProTracker parent account — the accept UI then asks for
    // the existing password instead of prompting to create a new one.
    public bool AccountExists { get; set; }
}

public class AcceptParentInviteDto
{
    public string Token { get; set; } = "";
    public string Password { get; set; } = "";
}

// --- Parent: reading their children ---

public class ParentChildDto
{
    public int PlayerId { get; set; }
    public string FullName { get; set; } = "";
    public string? TeamName { get; set; }
    public string? SportName { get; set; }
    public string? PositionName { get; set; }
    public int? Age { get; set; }
    public int? FitnessLevel { get; set; }
    public double? OverallAverage { get; set; }
    public int ActiveInjuryCount { get; set; }
}

public class ChildInjuryDto
{
    public string InjuryType { get; set; } = "";
    public string? BodyPart { get; set; }
    public string Severity { get; set; } = "";
    public string RecoveryStatus { get; set; } = "";
    public DateTime InjuryDate { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
}

public class ChildSessionDto
{
    public string Title { get; set; } = "";
    public string SessionType { get; set; } = "";
    public DateTime StartTime { get; set; }
    public int DurationMinutes { get; set; }
    public string? Location { get; set; }
}

public class ChildTaskDto
{
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Priority { get; set; } = "";
    public DateTime? DueDate { get; set; }
    public bool IsCompleted { get; set; }
}

public class ChildWellbeingPointDto
{
    public DateTime Date { get; set; }
    public int Feeling { get; set; }
    public int Energy { get; set; }
    public int Sleep { get; set; }
    public bool HasPain { get; set; }
    public double Score { get; set; }
}

public class ChildOverviewDto
{
    public int PlayerId { get; set; }
    public string FullName { get; set; } = "";
    public string? TeamName { get; set; }
    public string? SportName { get; set; }
    public string? PositionName { get; set; }
    public int? Age { get; set; }
    public double? Height { get; set; }
    public double? Weight { get; set; }
    public int? FitnessLevel { get; set; }

    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public double? OverallAverage { get; set; }
    public DateTime? LastAssessmentDate { get; set; }

    public List<ChildInjuryDto> Injuries { get; set; } = new();
    public List<ChildSessionDto> UpcomingSessions { get; set; } = new();
    public List<ChildTaskDto> Tasks { get; set; } = new();
    public List<ChildWellbeingPointDto> Wellbeing { get; set; } = new();
    public double? WellbeingScore { get; set; }
}
