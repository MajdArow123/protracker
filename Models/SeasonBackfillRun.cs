namespace ProTracker.Models;

// Phase 10 S7: audit row for a season-backfill execute. One row per run, written after
// the stamping batches commit. StampedIdsJson makes every run inspectable and
// mechanically revertible later — by ruling there is NO revert endpoint in S7; the
// stored ids are the revert path if one is ever needed.
public class SeasonBackfillRun
{
    public int Id { get; set; }

    public string OwnerId { get; set; } = "";
    public ApplicationUser Owner { get; set; } = null!;

    public DateTime RanAt { get; set; }

    // Per-entity outcome counts as JSON:
    // {"matchResults":{"stamped":3,"gap":1,"ambiguous":0}, ...}
    public string CountsJson { get; set; } = "{}";

    // Stamped record ids grouped by entity type as JSON (jsonb on Postgres):
    // {"matchResults":[1,2], ...}
    public string StampedIdsJson { get; set; } = "{}";
}
