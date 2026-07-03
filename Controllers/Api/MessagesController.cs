using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/messages")]
public class MessagesController : ApiControllerBase
{
    private readonly IMessageService _service;

    public MessagesController(IMessageService service)
    {
        _service = service;
    }

    [HttpGet("conversations")]
    public async Task<ActionResult> GetConversations() => Success(await _service.GetConversationsAsync(User));

    [HttpGet("contacts")]
    public async Task<ActionResult> GetContacts() => Success(await _service.GetContactsAsync(User));

    [HttpGet("conversation/{otherUserId}")]
    public async Task<ActionResult> GetConversation(string otherUserId) => Success(await _service.GetConversationAsync(User, otherUserId));

    [HttpPost]
    public async Task<ActionResult> Send(SendMessageDto dto) => Created(await _service.SendAsync(User, dto));

    // Delete a message you sent.
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }

    [HttpPatch("conversation/{otherUserId}/read")]
    public async Task<ActionResult> MarkRead(string otherUserId)
    {
        await _service.MarkReadAsync(User, otherUserId);
        return NoContentSuccess();
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult> UnreadCount() => Success(new UnreadCountDto { UnreadCount = await _service.GetUnreadCountAsync(User) });
}
