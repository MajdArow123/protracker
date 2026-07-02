using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// A direct message between two users (coach ↔ athlete). ConversationId is a stable
// key derived from the two participant ids ("{smallerId}_{largerId}") so both
// directions of a conversation share one id.
public class Message
{
    public int Id { get; set; }

    [Required]
    public string SenderId { get; set; } = "";
    [Required]
    public string ReceiverId { get; set; } = "";

    [Required]
    public string Content { get; set; } = "";

    public string ConversationId { get; set; } = "";

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    public static string BuildConversationId(string a, string b) =>
        string.CompareOrdinal(a, b) <= 0 ? $"{a}_{b}" : $"{b}_{a}";
}
