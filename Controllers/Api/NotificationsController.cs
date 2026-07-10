using Microsoft.AspNetCore.Mvc;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Persistent per-user notifications. All roles; scoped to the caller's own userId.
public class NotificationsController : ApiControllerBase
{
    private readonly INotificationService _notifications;
    private readonly IAccessControlService _access;

    public NotificationsController(INotificationService notifications, IAccessControlService access)
    {
        _notifications = notifications;
        _access = access;
    }

    // GET /api/notifications?page=1&unreadOnly=false
    [HttpGet]
    public async Task<ActionResult> Get([FromQuery] int page = 1, [FromQuery] bool unreadOnly = false)
    {
        var userId = _access.RequireUserId(User);
        return Success(await _notifications.GetForUserAsync(userId, page, unreadOnly));
    }

    // GET /api/notifications/unread-count
    [HttpGet("unread-count")]
    public async Task<ActionResult> UnreadCount()
    {
        var userId = _access.RequireUserId(User);
        return Success(new { count = await _notifications.GetUnreadCountAsync(userId) });
    }

    // PATCH /api/notifications/{id}/read
    [HttpPatch("{id:int}/read")]
    public async Task<ActionResult> MarkRead(int id)
    {
        var userId = _access.RequireUserId(User);
        var ok = await _notifications.MarkReadAsync(userId, id);
        return ok ? NoContentSuccess() : NotFound();
    }

    // PATCH /api/notifications/read-all
    [HttpPatch("read-all")]
    public async Task<ActionResult> MarkAllRead()
    {
        var userId = _access.RequireUserId(User);
        return Success(new { updated = await _notifications.MarkAllReadAsync(userId) });
    }

    // DELETE /api/notifications/{id}
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id)
    {
        var userId = _access.RequireUserId(User);
        var ok = await _notifications.DeleteAsync(userId, id);
        return ok ? NoContentSuccess() : NotFound();
    }
}
