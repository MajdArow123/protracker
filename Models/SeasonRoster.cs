namespace ProTracker.Models;

// §5d Q2: where a stint came from. Server-stamped by code path ONLY — never bound from
// a client DTO, immutable on update. Seeded is reserved for a possible future scripted
// vehicle (unused as of §5d — the demo dogfood produces CoachConfirmed by construction).
public enum StintSource
{
    Manual = 0,        // the S6 single-stint write path
    CoachConfirmed = 1, // the §5d bulk "Confirm historical roster" flow
    SystemOnJoin = 2,  // the §5d forward path (join events)
    Seeded = 3,        // reserved, unused
}

// Historical truth: who was on which team during a season, and when. Deliberately NOT
// unique per (PlayerId, SeasonId) — a player can leave and rejoin within one season,
// producing two rows. Forward-path roster EVENTS auto-write rows (§5d Q3); historical
// stints are only ever human-asserted (S6 manual path / §5d Q1 confirmation).
public class SeasonRoster
{
    public int Id { get; set; }

    public StintSource Source { get; set; } = StintSource.Manual;

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
