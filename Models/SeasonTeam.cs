namespace ProTracker.Models;

// A team's participation in a season. Separate from SeasonRoster on purpose: a team can
// participate with an empty roster (preseason). Unique per (SeasonId, TeamId).
public class SeasonTeam
{
    public int Id { get; set; }

    public int SeasonId { get; set; }
    public Season Season { get; set; } = null!;

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    // Per-season benchmark profile for this team; Team.BenchmarkProfileId stays the
    // team's current default.
    public int? BenchmarkProfileId { get; set; }
    public BenchmarkProfile? BenchmarkProfile { get; set; }
}
