using ProTracker.Models;

namespace ProTracker.Dtos;

public class PlayerMatchRatingDto
{
    public int Id { get; set; }
    public int MatchResultId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public decimal Rating { get; set; }
    public int Goals { get; set; }
    public int Assists { get; set; }
    public int YellowCards { get; set; }
    public int RedCards { get; set; }
    public int MinutesPlayed { get; set; }
    public string? Notes { get; set; }
    // Enriched for the athlete's "My Matches" / player match-history view.
    public DateTime? MatchDate { get; set; }
    public string? OpponentName { get; set; }
}

public class MatchResultDto
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public string OpponentName { get; set; } = "";
    public DateTime MatchDate { get; set; }
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public bool IsHome { get; set; }
    public int OurScore { get; set; }
    public int OpponentScore { get; set; }
    public MatchOutcome Result { get; set; }
    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }
    public List<PlayerMatchRatingDto> Ratings { get; set; } = new();
}

public class CreateMatchResultDto
{
    public string OpponentName { get; set; } = "";
    public DateTime MatchDate { get; set; }
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public bool IsHome { get; set; }
    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }
}

public class CreatePlayerMatchRatingDto
{
    public int PlayerId { get; set; }
    public decimal Rating { get; set; }
    public int Goals { get; set; }
    public int Assists { get; set; }
    public int YellowCards { get; set; }
    public int RedCards { get; set; }
    public int MinutesPlayed { get; set; }
    public string? Notes { get; set; }
}

// Bulk upsert of a match's player ratings.
public class SaveMatchRatingsDto
{
    public List<CreatePlayerMatchRatingDto> Ratings { get; set; } = new();
}
