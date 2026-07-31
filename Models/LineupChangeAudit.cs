namespace ProTracker.Models;

/// <summary>
/// Lightweight lineup change audit (Phase 6, blueprint §7-challenge-3): who /
/// when / a one-line summary derived from a REAL diff (LineupDiffSummarizer) —
/// deliberately NOT full snapshots (restore/version-compare stay deferred).
/// Written in the same transaction as the change it records. LineupId is
/// SetNull so audit history survives lineup deletion; KeyLabel + ChangedByName
/// are denormalized (the CoachName precedent) so rows stay readable afterwards.
/// </summary>
public class LineupChangeAudit
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public int? LineupId { get; set; }
    public Lineup? Lineup { get; set; }

    /// <summary>Human label of the lineup key: "Default XI", the lineup name, or a match label.</summary>
    public string KeyLabel { get; set; } = "";

    public string ChangedByUserId { get; set; } = "";
    public string ChangedByName { get; set; } = "";

    /// <summary>created | saved | published | unpublished | deleted.</summary>
    public string Action { get; set; } = "";

    /// <summary>Lineup version after the change (0 for deleted).</summary>
    public int Version { get; set; }

    /// <summary>One line derived from the actual diff — never a generic "updated".</summary>
    public string Summary { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
