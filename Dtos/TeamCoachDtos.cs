using ProTracker.Models;

namespace ProTracker.Dtos;

public class CoachPermissionsDto
{
    public bool CanAssessPlayers { get; set; }
    public bool CanAssignTasks { get; set; }
    public bool CanViewPrivateNotes { get; set; }
    public bool CanManagePlayers { get; set; }
    public bool CanManageTeam { get; set; }
}

// One coach on a team (head coach or an assistant/analyst).
public class TeamCoachDto
{
    // Present only for assistants/analysts (the TeamCoachRole id); null for the head coach.
    public int? Id { get; set; }
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public CoachRoleType Role { get; set; }
    public bool IsHeadCoach { get; set; }
    public bool IsYou { get; set; }
    public CoachPermissionsDto Permissions { get; set; } = new();
    public DateTime? AcceptedAt { get; set; }
}

public class InviteCoachDto
{
    public string Email { get; set; } = "";
    public CoachRoleType Role { get; set; } = CoachRoleType.AssistantCoach;
    public CoachPermissionsDto Permissions { get; set; } = new();
}

public class InviteCoachResultDto
{
    public string Email { get; set; } = "";
    public string InviteUrl { get; set; } = "";
}

// Public view returned when validating an invite token.
public class ValidateCoachInviteDto
{
    public bool Valid { get; set; }
    public string? TeamName { get; set; }
    public string? SportName { get; set; }
    public string? InviterName { get; set; }
    public string? Email { get; set; }
    public CoachRoleType Role { get; set; }
    public bool EmailHasAccount { get; set; }
}

public class AcceptCoachInviteDto
{
    public string Token { get; set; } = "";
    // Required only when the invited email has no account yet.
    public string? Password { get; set; }
    public string? FullName { get; set; }
}
