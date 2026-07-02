namespace ProTracker.Dtos;

public class MessageDto
{
    public int Id { get; set; }
    public string SenderId { get; set; } = "";
    public string ReceiverId { get; set; } = "";
    public string Content { get; set; } = "";
    public DateTime SentAt { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public bool IsMine { get; set; }
}

public class ConversationDto
{
    public string OtherUserId { get; set; } = "";
    public string OtherUserName { get; set; } = "";
    public string OtherUserRole { get; set; } = "";
    public string LastMessage { get; set; } = "";
    public DateTime LastMessageAt { get; set; }
    public bool LastMessageMine { get; set; }
    public int UnreadCount { get; set; }
}

public class SendMessageDto
{
    public string ReceiverId { get; set; } = "";
    public string Content { get; set; } = "";
}

public class UnreadCountDto
{
    public int UnreadCount { get; set; }
}
