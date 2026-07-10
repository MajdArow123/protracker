namespace ProTracker.Models;

// Sport-specific statistics from one match, stored as a flat JSON object of numeric
// fields (keys differ per sport — see EvidenceScoringEngine.MatchStatMapping).
// Soccer:          { goals, assists, shots, shotsOnTarget, passes, passAccuracy,
//                    dribbles, tackles, interceptions, minutesPlayed, distanceKm }
// Basketball:      { points, rebounds, assists, steals, blocks, fgPercentage,
//                    threePercentage, ftPercentage, turnovers, minutesPlayed }
// Volleyball:      { kills, errors, attempts, killPercentage, serves, serviceErrors,
//                    aces, digs, blocks, assists }
// Beach Volleyball:{ kills, errors, attempts, serves, aces, serviceErrors, digs,
//                    blocks, assists }
// Tennis:          { aces, doubleFaults, firstServeIn, firstServeWon, secondServeWon,
//                    breakPointsSaved, winners, unforcedErrors, gamesWon }
public class MatchStatEntry
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // Optional link to a logged team/solo match result.
    public int? MatchResultId { get; set; }
    public MatchResult? MatchResult { get; set; }

    public DateTime StatDate { get; set; } = DateTime.UtcNow;

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    // Flat JSON object of numeric stats (see keys above).
    public string StatsJson { get; set; } = "{}";

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
