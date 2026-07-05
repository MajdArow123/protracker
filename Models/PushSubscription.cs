namespace ProTracker.Models;

// A browser's Web Push subscription for a user. One user may have several (multiple devices/
// browsers). Keyed uniquely by Endpoint; dead endpoints are pruned when a send returns 404/410.
public class PushSubscription
{
    public int Id { get; set; }

    public string UserId { get; set; } = "";

    // The push service endpoint URL the browser handed us (unique per subscription).
    public string Endpoint { get; set; } = "";

    // Encryption keys from the browser's PushSubscription.getKey().
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
