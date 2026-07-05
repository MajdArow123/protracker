using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;
using WebPush;
using PushModel = ProTracker.Models.PushSubscription;

namespace ProTracker.Services;

public interface IPushService
{
    bool IsConfigured { get; }
    string? PublicKey { get; }
    Task SaveSubscriptionAsync(string userId, SavePushSubscriptionDto dto);
    Task RemoveSubscriptionAsync(string userId, string endpoint);
    // Fire-and-forget: delivery happens on a background scope so it never delays the request.
    void SendToUser(string userId, PushPayload payload);
    void SendToUsers(IEnumerable<string> userIds, PushPayload payload);
}

// Web Push (VAPID) sender. Registered as a singleton; it uses IServiceScopeFactory for DB access
// so background sends don't touch a request-scoped DbContext. If VAPID keys aren't configured it
// degrades gracefully (subscriptions still store; sends are no-ops) — mirrors EmailService.
public class PushService : IPushService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PushService> _logger;
    private readonly VapidDetails? _vapid;
    private readonly WebPushClient _client = new();

    public PushService(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<PushService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var subject = config["Vapid:Subject"];
        PublicKey = config["Vapid:PublicKey"];
        var privateKey = config["Vapid:PrivateKey"];
        if (!string.IsNullOrWhiteSpace(subject) && !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(privateKey))
            _vapid = new VapidDetails(subject, PublicKey, privateKey);
        else
            _logger.LogInformation("[Push] VAPID keys not fully configured; push sends are disabled.");
    }

    public bool IsConfigured => _vapid != null;
    public string? PublicKey { get; }

    public async Task SaveSubscriptionAsync(string userId, SavePushSubscriptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Endpoint)) return;
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint);
        if (existing != null)
        {
            existing.UserId = userId; // re-point if the same endpoint is now a different user
            existing.P256dh = dto.P256dh;
            existing.Auth = dto.Auth;
        }
        else
        {
            db.PushSubscriptions.Add(new PushModel
            {
                UserId = userId,
                Endpoint = dto.Endpoint,
                P256dh = dto.P256dh,
                Auth = dto.Auth,
            });
        }
        await db.SaveChangesAsync();
    }

    public async Task RemoveSubscriptionAsync(string userId, string endpoint)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var subs = await db.PushSubscriptions.Where(s => s.Endpoint == endpoint && s.UserId == userId).ToListAsync();
        if (subs.Count > 0)
        {
            db.PushSubscriptions.RemoveRange(subs);
            await db.SaveChangesAsync();
        }
    }

    public void SendToUser(string userId, PushPayload payload) => SendToUsers(new[] { userId }, payload);

    public void SendToUsers(IEnumerable<string> userIds, PushPayload payload)
    {
        if (_vapid == null) return;
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return;

        // Detach from the request: deliver in the background.
        _ = Task.Run(() => DeliverAsync(ids, payload));
    }

    private async Task DeliverAsync(List<string> userIds, PushPayload payload)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var subs = await db.PushSubscriptions.Where(s => userIds.Contains(s.UserId)).ToListAsync();
            if (subs.Count == 0) return;

            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            var dead = new List<PushModel>();

            foreach (var s in subs)
            {
                try
                {
                    var sub = new WebPush.PushSubscription(s.Endpoint, s.P256dh, s.Auth);
                    await _client.SendNotificationAsync(sub, json, _vapid);
                }
                catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
                {
                    dead.Add(s); // subscription expired/unsubscribed — prune it.
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Push] Failed to send to endpoint {Endpoint}", s.Endpoint);
                }
            }

            if (dead.Count > 0)
            {
                db.PushSubscriptions.RemoveRange(dead);
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Push] Delivery failed");
        }
    }
}
