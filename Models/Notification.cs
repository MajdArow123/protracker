namespace ProTracker.Models;

public enum NotificationType
{
    General,
    NewMessage,
    NewTask,
    TaskOverdue,
    NewAnnouncement,
    InjuryAlert,
    SessionReminder,
    ConnectionRequest,
    ConnectionAccepted,
    ConnectionDeclined,
    AthleteJoined,
    GoalAchieved,
    AssessmentDue,
    RecoveryMilestone,
    RecoveryPlanReady,
    ReviewReceived,
    LeagueMatchScheduled,
}

// A persistent, per-recipient in-app notification. Created at the event source (see
// NotificationService), surfaced in the bell dropdown + /notifications page, and pushed
// live over SignalR + web-push. Replaces the old localStorage-derived "seen" mechanism.
public class Notification
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";     // recipient (ApplicationUser id)
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public NotificationType Type { get; set; } = NotificationType.General;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string? ActionUrl { get; set; }        // where clicking it navigates (e.g. "/messages")
    public int? RelatedEntityId { get; set; }     // e.g. task id, match id — for dedup + deep links
    public string? RelatedEntityType { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
}
