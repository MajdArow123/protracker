using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Hubs;
using ProTracker.Models;

namespace ProTracker.Services;

public interface INotificationService
{
    // Best-effort: persists a notification and pushes it live (SignalR + web-push). Never throws
    // — a notification failure must not break the action that triggered it.
    Task CreateAsync(string userId, string title, string message, NotificationType type,
        string? actionUrl = null, int? relatedEntityId = null, string? relatedEntityType = null,
        DateTime? expiresAt = null);
    Task CreateManyAsync(IEnumerable<string> userIds, string title, string message, NotificationType type,
        string? actionUrl = null, int? relatedEntityId = null, string? relatedEntityType = null,
        DateTime? expiresAt = null);

    Task<NotificationPageDto> GetForUserAsync(string userId, int page, bool unreadOnly);
    Task<int> GetUnreadCountAsync(string userId);
    Task<bool> MarkReadAsync(string userId, int id);
    Task<int> MarkAllReadAsync(string userId);
    Task<bool> DeleteAsync(string userId, int id);
    Task<int> DeleteOldAsync(int olderThanDays = 90);
}

public class NotificationService : INotificationService
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _context;          // request-scoped: controller reads/mutations
    private readonly IServiceScopeFactory _scopeFactory;     // isolated writes for event-triggered creates
    private readonly IHubContext<ChatHub> _hub;
    private readonly IPushService _push;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(ApplicationDbContext context, IServiceScopeFactory scopeFactory,
        IHubContext<ChatHub> hub, IPushService push, ILogger<NotificationService> logger)
    {
        _context = context;
        _scopeFactory = scopeFactory;
        _hub = hub;
        _push = push;
        _logger = logger;
    }

    public Task CreateAsync(string userId, string title, string message, NotificationType type,
        string? actionUrl = null, int? relatedEntityId = null, string? relatedEntityType = null,
        DateTime? expiresAt = null)
        => CreateManyAsync(new[] { userId }, title, message, type, actionUrl, relatedEntityId, relatedEntityType, expiresAt);

    public async Task CreateManyAsync(IEnumerable<string> userIds, string title, string message, NotificationType type,
        string? actionUrl = null, int? relatedEntityId = null, string? relatedEntityType = null,
        DateTime? expiresAt = null)
    {
        var recipients = userIds.Where(u => !string.IsNullOrEmpty(u)).Distinct().ToList();
        if (recipients.Count == 0) return;

        var rows = recipients.Select(uid => new Notification
        {
            UserId = uid,
            Title = title,
            Message = message,
            Type = type,
            ActionUrl = actionUrl,
            RelatedEntityId = relatedEntityId,
            RelatedEntityType = relatedEntityType,
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        // Persist on an isolated context so we never touch (or fail) the caller's unit of work / transaction.
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var ctx = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            ctx.Notifications.AddRange(rows);
            await ctx.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist notification(s) of type {Type}", type);
            return;
        }

        // Live delivery — best-effort, never throws.
        foreach (var n in rows)
        {
            try { await _hub.Clients.Group(n.UserId).SendAsync("Notification", NotificationDto.From(n)); }
            catch (Exception ex) { _logger.LogDebug(ex, "SignalR notification delivery failed"); }
        }

        try
        {
            _push.SendToUsers(recipients, new PushPayload
            {
                Title = title,
                Body = message.Length > 140 ? message[..140] + "…" : message,
                Url = actionUrl,
                Tag = $"notif-{type}-{relatedEntityId?.ToString() ?? "0"}",
            });
        }
        catch (Exception ex) { _logger.LogDebug(ex, "Web-push notification delivery failed"); }
    }

    public async Task<NotificationPageDto> GetForUserAsync(string userId, int page, bool unreadOnly)
    {
        if (page < 1) page = 1;
        var q = _context.Notifications.Where(n => n.UserId == userId);
        if (unreadOnly) q = q.Where(n => !n.IsRead);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * PageSize)
            .Take(PageSize)
            .Select(n => NotificationDto.From(n))
            .ToListAsync();

        var unread = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

        return new NotificationPageDto
        {
            Items = items,
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            HasMore = page * PageSize < total,
            UnreadCount = unread,
        };
    }

    public Task<int> GetUnreadCountAsync(string userId) =>
        _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

    public async Task<bool> MarkReadAsync(string userId, int id)
    {
        var n = await _context.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n == null) return false;
        if (!n.IsRead)
        {
            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
        return true;
    }

    public async Task<int> MarkAllReadAsync(string userId)
    {
        var unread = await _context.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var n in unread) { n.IsRead = true; n.ReadAt = now; }
        if (unread.Count > 0) await _context.SaveChangesAsync();
        return unread.Count;
    }

    public async Task<bool> DeleteAsync(string userId, int id)
    {
        var n = await _context.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n == null) return false;
        _context.Notifications.Remove(n);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<int> DeleteOldAsync(int olderThanDays = 90)
    {
        var cutoff = DateTime.UtcNow.AddDays(-olderThanDays);
        var old = await _context.Notifications.Where(n => n.CreatedAt < cutoff).ToListAsync();
        if (old.Count == 0) return 0;
        _context.Notifications.RemoveRange(old);
        await _context.SaveChangesAsync();
        return old.Count;
    }
}
