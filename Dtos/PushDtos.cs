namespace ProTracker.Dtos;

// Incoming browser subscription (flattened from PushSubscription.toJSON()).
public class SavePushSubscriptionDto
{
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}

public class UnsubscribeDto
{
    public string Endpoint { get; set; } = "";
}

// What the service worker renders as a notification.
public class PushPayload
{
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string? Url { get; set; }
    public string? Tag { get; set; }
}
