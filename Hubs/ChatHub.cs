using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ProTracker.Hubs;

// Real-time messaging hub. Message persistence still happens over REST (POST /api/messages);
// after saving, the controller pushes the new message here so recipients get it instantly
// instead of polling. The hub itself owns transient state: presence + typing indicators.
// Uses the JWT bearer scheme explicitly (the default scheme is the Identity cookie).
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
public class ChatHub : Hub
{
    // userId -> number of live connections (a user may have several tabs/devices open).
    private static readonly ConcurrentDictionary<string, int> Connections = new();

    private string UserId => Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!;

    public static bool IsOnline(string userId) => Connections.ContainsKey(userId);

    public override async Task OnConnectedAsync()
    {
        var uid = UserId;
        // Group per user so message pushes / typing can target every device they're on.
        await Groups.AddToGroupAsync(Context.ConnectionId, uid);

        var count = Connections.AddOrUpdate(uid, 1, (_, c) => c + 1);
        if (count == 1)
            await Clients.Others.SendAsync("PresenceChanged", uid, true);

        // Seed the freshly-connected client with everyone currently online.
        await Clients.Caller.SendAsync("OnlineUsers", Connections.Keys.ToArray());
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var uid = UserId;
        var count = Connections.AddOrUpdate(uid, 0, (_, c) => Math.Max(0, c - 1));
        if (count == 0)
        {
            Connections.TryRemove(uid, out _);
            await Clients.Others.SendAsync("PresenceChanged", uid, false);
        }
        await base.OnDisconnectedAsync(exception);
    }

    // Called by the composer as the user types; notifies the other participant only.
    public Task Typing(string otherUserId) =>
        Clients.Group(otherUserId).SendAsync("Typing", UserId);

    public Task StopTyping(string otherUserId) =>
        Clients.Group(otherUserId).SendAsync("StopTyping", UserId);
}
