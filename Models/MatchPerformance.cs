using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class MatchPerformance
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public DateTime MatchDate { get; set; }

    [Required]
    public string Opponent { get; set; } = "";

    // 1-10 scale, consistent across the whole app.
    [Range(1, 10)]
    public int PerformanceRating { get; set; }

    public string? Notes { get; set; }

    // Stored as a JSON object keyed by SportStatCategory name. Kept as JSON rather than a
    // normalized table for Phase 2 to avoid hard-coding a per-sport schema; if structured
    // querying over match stats is needed later, this can be normalized the same way
    // PlayerStatScore normalizes assessment scores.
    public string? SportSpecificStats { get; set; }
}
