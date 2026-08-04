namespace ProTracker.Models;

// Historical truth: who was on which team during a season, and when. Deliberately NOT
// unique per (PlayerId, SeasonId) — a player can leave and rejoin within one season,
// producing two rows. Never backfilled from Player.TeamId (that would assert membership
// for the whole season, which we don't know); coaches populate it explicitly.
public class SeasonRoster
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public int SeasonId { get; set; }
    public Season Season { get; set; } = null!;

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public int? JerseyNumber { get; set; }

    public int? PositionId { get; set; }
    public Position? Position { get; set; }

    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
}
