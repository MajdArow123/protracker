using System.Text.Json;

namespace ProTracker.Models;

public enum CoachRoleType
{
    HeadCoach,
    AssistantCoach,
    Analyst
}

// What an assistant coach / analyst is allowed to do on a team. Serialized to JSON on the
// TeamCoachRole / AssistantCoachInvite. The head coach implicitly has all permissions.
public class CoachPermissions
{
    public bool CanAssessPlayers { get; set; }
    public bool CanAssignTasks { get; set; }
    public bool CanViewPrivateNotes { get; set; }
    public bool CanManagePlayers { get; set; }
    public bool CanManageTeam { get; set; }

    public static CoachPermissions All() => new()
    {
        CanAssessPlayers = true, CanAssignTasks = true, CanViewPrivateNotes = true,
        CanManagePlayers = true, CanManageTeam = true,
    };

    public string ToJson() => JsonSerializer.Serialize(this);

    public static CoachPermissions FromJson(string? json) =>
        string.IsNullOrWhiteSpace(json) ? new CoachPermissions() : (JsonSerializer.Deserialize<CoachPermissions>(json) ?? new CoachPermissions());
}

// A coaching-staff membership: links a user (assistant/analyst) to a team with a set of
// permissions. The head coach is NOT stored here — they are Team.CoachId.
public class TeamCoachRole
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    // ApplicationUser Id of the assistant coach / analyst.
    public string UserId { get; set; } = "";

    public CoachRoleType Role { get; set; } = CoachRoleType.AssistantCoach;

    // ApplicationUser Id of the head coach who invited them.
    public string InvitedByUserId { get; set; } = "";

    // Permissions serialized as JSON.
    public string PermissionsJson { get; set; } = "";

    public DateTime? AcceptedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// A pending email invite for an assistant coach / analyst to join a team.
public class AssistantCoachInvite
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public string InviterUserId { get; set; } = "";

    public string Email { get; set; } = "";

    public CoachRoleType Role { get; set; } = CoachRoleType.AssistantCoach;

    // The permissions the invitee will get on accept (JSON).
    public string PermissionsJson { get; set; } = "";

    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
