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

    // ── Coach-authored tactical layer (Phase 3) ──────────────────────────────
    // Captain/vice must be in the XI (validated in LineupService.UpsertAsync).
    // Player deleted → SetNull (an honestly-empty captaincy, unlike a slot row,
    // which cascades away). Transferred-but-existing players are dropped
    // roster-keyed on the frontend and re-validated on the next save.
    public int? CaptainPlayerId { get; set; }
    public Player? Captain { get; set; }

    public int? ViceCaptainPlayerId { get; set; }
    public Player? ViceCaptain { get; set; }

    /// <summary>Free-form coach notes for this lineup.</summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Comma-separated presentation-only label keys (e.g. "highPress"). The
    /// frontend owns the per-sport catalog — opaque here, like SlotKey.
    /// Explicitly NOT a simulation input.
    /// </summary>
    public string? TacticalLabels { get; set; }

    public List<LineupSlot> Slots { get; set; } = new();
    public List<SetPieceAssignment> SetPieces { get; set; } = new();
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

    /// <summary>Per-sport preset role label key (frontend-owned catalog). Null = not set.</summary>
    public string? Role { get; set; }

    /// <summary>Optional coach instructions for this slot (column ships in Phase 3; UI deferred).</summary>
    public string? Instructions { get; set; }
}

/// <summary>
/// A set-piece taker on a lineup (Phase 3). Type is an opaque sport-aware key
/// (e.g. "penalties", "cornersLeft") — the frontend owns the per-sport catalog,
/// mirroring SlotKey. One per (LineupId, Type), enforced in LineupService's
/// transactional upsert (codebase convention; no filtered index). Taker must be
/// in the XI. Player deleted → the row cascades away (a taker row without a
/// player is meaningless), mirroring slot semantics.
/// </summary>
public class SetPieceAssignment
{
    public int Id { get; set; }

    public int LineupId { get; set; }
    public Lineup Lineup { get; set; } = null!;

    public string Type { get; set; } = string.Empty;

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;
}
