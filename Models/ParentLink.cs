namespace ProTracker.Models;

// Associates a Parent-role user with a player (their child). A parent may be linked to several
// players; a player may have several guardians. Parent access is strictly read-only and scoped
// to the players they're linked to via this table.
public class ParentLink
{
    public int Id { get; set; }

    public string ParentUserId { get; set; } = "";

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
