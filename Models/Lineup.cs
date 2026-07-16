namespace ProTracker.Models;

/// <summary>
/// A saved team lineup (Phase 2 of the lineup view). Exactly one per
/// (TeamId, MatchResultId) key, enforced in LineupService's upsert:
///   MatchResultId == null  → the team's default XI (one per team)
///   MatchResultId set      → the lineup for that specific match (one per match)
/// Slot semantics (which keys exist, coordinates, formation shapes) are owned by
/// the frontend; the server stores assignments and enforces data integrity only.
/// </summary>
public class Lineup
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public int? MatchResultId { get; set; }
    public MatchResult? MatchResult { get; set; }

    /// <summary>Formation key, e.g. "4-3-3". Informational — validated for shape only.</summary>
    public string Formation { get; set; } = string.Empty;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>User who last saved — audit only.</summary>
    public string? UpdatedByUserId { get; set; }

    public List<LineupSlot> Slots { get; set; } = new();
}

public class LineupSlot
{
    public int Id { get; set; }

    public int LineupId { get; set; }
    public Lineup Lineup { get; set; } = null!;

    /// <summary>Frontend slot key, e.g. "GK", "D1", "A3", "L_B".</summary>
    public string SlotKey { get; set; } = string.Empty;

    // Deleting a player deletes their slot rows — the lineup then renders an
    // empty slot, never a dangling player id.
    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
}
