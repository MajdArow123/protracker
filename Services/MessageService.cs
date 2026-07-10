using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Hubs;
using ProTracker.Models;

namespace ProTracker.Services;

public class ContactDto
{
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
}

public interface IMessageService
{
    Task<List<ConversationDto>> GetConversationsAsync(ClaimsPrincipal user);
    Task<List<ContactDto>> GetContactsAsync(ClaimsPrincipal user);
    Task<List<MessageDto>> GetConversationAsync(ClaimsPrincipal user, string otherUserId);
    Task<MessageDto> SendAsync(ClaimsPrincipal user, SendMessageDto dto);
    Task MarkReadAsync(ClaimsPrincipal user, string otherUserId);
    Task<int> GetUnreadCountAsync(ClaimsPrincipal user);
    Task DeleteAsync(ClaimsPrincipal user, int messageId);
}

public class MessageService : IMessageService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IHubContext<ChatHub> _hub;
    private readonly INotificationService _notifications;

    public MessageService(ApplicationDbContext context, IAccessControlService access, UserManager<ApplicationUser> userManager, IHubContext<ChatHub> hub, INotificationService notifications)
    {
        _context = context;
        _access = access;
        _userManager = userManager;
        _hub = hub;
        _notifications = notifications;
    }

    public async Task<List<ContactDto>> GetContactsAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var contacts = new List<ContactDto>();

        if (user.IsInRole("Coach") || user.IsInRole("Admin"))
        {
            // Every athlete (linked player) on the coach's scoped teams.
            var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
            var players = await _context.Players
                .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value) && p.UserId != null)
                .Select(p => new { p.UserId, p.FullName })
                .ToListAsync();
            foreach (var p in players)
                contacts.Add(new ContactDto { UserId = p.UserId!, Name = p.FullName, Role = "Athlete" });
        }
        else if (user.IsInRole("Athlete"))
        {
            // The coach(es) of the athlete's team(s).
            var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
            var coachIds = await _context.CoachTeamScopes
                .Where(s => teamIds.Contains(s.TeamId))
                .Select(s => s.CoachId)
                .ToListAsync();
            var ownerIds = await _context.Teams
                .Where(t => teamIds.Contains(t.Id))
                .Select(t => t.CoachId)
                .ToListAsync();
            foreach (var cid in coachIds.Concat(ownerIds).Distinct())
            {
                var u = await _userManager.FindByIdAsync(cid);
                if (u != null)
                    contacts.Add(new ContactDto { UserId = cid, Name = u.DisplayName, Role = "Coach" });
            }
        }

        return contacts.GroupBy(c => c.UserId).Select(g => g.First()).OrderBy(c => c.Name).ToList();
    }

    public async Task<List<ConversationDto>> GetConversationsAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var messages = await _context.Messages
            .Where(m => m.SenderId == userId || m.ReceiverId == userId)
            .OrderByDescending(m => m.SentAt)
            .ToListAsync();

        var conversations = new List<ConversationDto>();
        foreach (var group in messages.GroupBy(m => m.ConversationId))
        {
            var last = group.First(); // already ordered desc
            var otherId = last.SenderId == userId ? last.ReceiverId : last.SenderId;
            var (name, role) = await ResolveUserAsync(otherId);
            conversations.Add(new ConversationDto
            {
                OtherUserId = otherId,
                OtherUserName = name,
                OtherUserRole = role,
                LastMessage = last.Content,
                LastMessageAt = last.SentAt,
                LastMessageMine = last.SenderId == userId,
                UnreadCount = group.Count(m => m.ReceiverId == userId && !m.IsRead),
            });
        }
        return conversations.OrderByDescending(c => c.LastMessageAt).ToList();
    }

    public async Task<List<MessageDto>> GetConversationAsync(ClaimsPrincipal user, string otherUserId)
    {
        var userId = _access.RequireUserId(user);
        await EnsureCanMessageAsync(user, otherUserId);
        var convId = Message.BuildConversationId(userId, otherUserId);
        var messages = await _context.Messages
            .Where(m => m.ConversationId == convId)
            .OrderBy(m => m.SentAt)
            .ToListAsync();
        return messages.Select(m => ToDto(m, userId)).ToList();
    }

    public async Task<MessageDto> SendAsync(ClaimsPrincipal user, SendMessageDto dto)
    {
        var userId = _access.RequireUserId(user);
        if (string.IsNullOrWhiteSpace(dto.Content))
            throw new ValidationApiException("Message content is required.");
        if (dto.ReceiverId == userId)
            throw new ValidationApiException("You cannot message yourself.");
        await EnsureCanMessageAsync(user, dto.ReceiverId);

        var message = new Message
        {
            SenderId = userId,
            ReceiverId = dto.ReceiverId,
            Content = dto.Content.Trim(),
            ConversationId = Message.BuildConversationId(userId, dto.ReceiverId),
            SentAt = DateTime.UtcNow,
        };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        // Push to the recipient (all their devices) and echo to the sender's other tabs. The DTO's
        // read/isMine flags are relative to the receiver, so build it from the receiver's viewpoint
        // for the receiver and the sender's for the sender.
        await _hub.Clients.Group(dto.ReceiverId).SendAsync("ReceiveMessage", ToDto(message, dto.ReceiverId));
        await _hub.Clients.Group(userId).SendAsync("ReceiveMessage", ToDto(message, userId));

        // Persist + push a notification for when the recipient's app is closed/backgrounded.
        var senderName = (await _userManager.FindByIdAsync(userId))?.DisplayName ?? "Someone";
        await _notifications.CreateAsync(dto.ReceiverId,
            $"New message from {senderName}",
            message.Content.Length > 120 ? message.Content[..120] + "…" : message.Content,
            NotificationType.NewMessage,
            actionUrl: "/messages");

        return ToDto(message, userId);
    }

    public async Task MarkReadAsync(ClaimsPrincipal user, string otherUserId)
    {
        var userId = _access.RequireUserId(user);
        var convId = Message.BuildConversationId(userId, otherUserId);
        var unread = await _context.Messages
            .Where(m => m.ConversationId == convId && m.ReceiverId == userId && !m.IsRead)
            .ToListAsync();
        foreach (var m in unread)
        {
            m.IsRead = true;
            m.ReadAt = DateTime.UtcNow;
        }
        if (unread.Count > 0)
            await _context.SaveChangesAsync();
    }

    public async Task<int> GetUnreadCountAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        return await _context.Messages.CountAsync(m => m.ReceiverId == userId && !m.IsRead);
    }

    // A user may delete a message they sent (admins may delete any).
    public async Task DeleteAsync(ClaimsPrincipal user, int messageId)
    {
        var userId = _access.RequireUserId(user);
        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId)
            ?? throw new NotFoundApiException($"Message {messageId} was not found.");
        if (!user.IsInRole("Admin") && message.SenderId != userId)
            throw new ForbiddenApiException("You can only delete messages you sent.");
        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();
    }

    // Coaches may only message athletes on their teams; athletes may only message a
    // coach who has scope on one of their teams. Admins may message anyone.
    private async Task EnsureCanMessageAsync(ClaimsPrincipal user, string otherUserId)
    {
        if (user.IsInRole("Admin")) return;
        var userId = _access.RequireUserId(user);
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);

        if (user.IsInRole("Coach"))
        {
            var ok = await _context.Players.AnyAsync(p => p.UserId == otherUserId && p.TeamId != null && teamIds.Contains(p.TeamId.Value));
            if (!ok) throw new ForbiddenApiException("You can only message athletes on your teams.");
            return;
        }

        if (user.IsInRole("Athlete"))
        {
            var isScopedCoach = await _context.CoachTeamScopes.AnyAsync(s => s.CoachId == otherUserId && teamIds.Contains(s.TeamId));
            var isOwnerCoach = await _context.Teams.AnyAsync(t => teamIds.Contains(t.Id) && t.CoachId == otherUserId);
            if (!isScopedCoach && !isOwnerCoach)
                throw new ForbiddenApiException("You can only message your coach.");
            return;
        }

        throw new ForbiddenApiException();
    }

    private async Task<(string name, string role)> ResolveUserAsync(string userId)
    {
        var u = await _userManager.FindByIdAsync(userId);
        if (u == null) return ("Unknown", "");
        var roles = await _userManager.GetRolesAsync(u);
        var role = roles.Contains("Coach") ? "Coach" : roles.Contains("Athlete") ? "Athlete" : roles.FirstOrDefault() ?? "";
        return (u.DisplayName, role);
    }

    private static MessageDto ToDto(Message m, string userId) => new()
    {
        Id = m.Id,
        SenderId = m.SenderId,
        ReceiverId = m.ReceiverId,
        Content = m.Content,
        SentAt = m.SentAt,
        IsRead = m.IsRead,
        ReadAt = m.ReadAt,
        IsMine = m.SenderId == userId,
    };
}
