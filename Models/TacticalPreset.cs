namespace ProTracker.Models;

/// <summary>
/// A reusable, coach-owned tactical bundle (Phase 6): formation + per-slot role
/// keys + label keys for one sport. Role/label keys are opaque here — the
/// frontend owns the per-sport catalog (the SlotKey precedent). Deliberately
/// contains NO player ids (captain/vice/set-piece takers are player-bound, a
/// preset must be reusable across teams and seasons). Applying a preset is a
/// client-side diff + merge into the draft; the server only stores and serves.
/// One per (CoachId, SportId, normalized Name), cap per coach — both enforced
/// in TacticalPresetService (codebase convention; no filtered index).
/// </summary>
public class TacticalPreset
{
    public int Id { get; set; }

    // ApplicationUser Id of the coach who owns this preset.
    public string CoachId { get; set; } = "";

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    public string Name { get; set; } = "";

    /// <summary>Formation key, e.g. "4-3-3". Null for fixed-layout court sports.</summary>
    public string? Formation { get; set; }

    /// <summary>JSON payload: { "roles": { slotKey: roleKey }, "labels": [key] }.</summary>
    public string SettingsJson { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
