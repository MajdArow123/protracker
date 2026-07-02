using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum MatchOutcome
{
    Win,
    Draw,
    Loss
}

// A team-level game result. Distinct from MatchPerformance (a single player's
// per-match rating with no team match entity). Individual ratings hang off this
// via PlayerMatchRating.
public class MatchResult
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [Required]
    public string OpponentName { get; set; } = "";

    public DateTime MatchDate { get; set; }

    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public bool IsHome { get; set; }

    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }

    public List<PlayerMatchRating> Ratings { get; set; } = new();
}
