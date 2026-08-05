using ProTracker.Models;

namespace ProTracker.Dtos;

public class PlayerMatchRatingDto
{
    public int Id { get; set; }
    public int MatchResultId { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public decimal Rating { get; set; }
    // Sport-specific stats as a JSON object string (source of truth going forward).
    public string? StatJson { get; set; }
    // Legacy soccer fields (still populated for soccer; kept for backward compat).
    public int Goals { get; set; }
    public int Assists { get; set; }
    public int YellowCards { get; set; }
    public int RedCards { get; set; }
    public int MinutesPlayed { get; set; }
    public string? Notes { get; set; }
    // Enriched for the athlete's "My Matches" / player match-history view.
    public DateTime? MatchDate { get; set; }
    public string? OpponentName { get; set; }
    public ScoreFormat? ScoreFormat { get; set; }
}

public class MatchResultDto
{
    public int Id { get; set; }
    // Set only on a CREATE response when season resolution was Ambiguous — a
    // non-blocking nudge (Phase 10 S3); null on reads and on clean resolutions.
    public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    // Null for a solo athlete's personal match.
    public int? TeamId { get; set; }
    public int? PlayerId { get; set; }
    public string TeamName { get; set; } = "";
    public string OpponentName { get; set; } = "";
    public DateTime MatchDate { get; set; }
    public MatchStatus Status { get; set; }
    // Score/outcome fields are null on a Scheduled fixture — an unplayed match has no
    // score, and the API never asserts one (the stored 0-0 is masked here, at read).
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public bool IsHome { get; set; }
    public int? OurScore { get; set; }
    public int? OpponentScore { get; set; }
    public MatchOutcome? Result { get; set; }
    public ScoreFormat ScoreFormat { get; set; }
    public string? SetScores { get; set; }
    // Convenience "our - opp" string (frontend may render richer, sport-specific views).
    public string? ScoreDisplay { get; set; }
    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }
    // Coach-entered opponent plan — badged coach-entered in the UI, never recorded fact.
    public string? OpponentFormation { get; set; }
    public string? ScoutingNotes { get; set; }
    public List<PlayerMatchRatingDto> Ratings { get; set; } = new();
}

public class CreateMatchResultDto
{
    public string OpponentName { get; set; } = "";
    public DateTime MatchDate { get; set; }
    // Played (default — pre-Phase-7 clients omit it) records a result; Scheduled
    // creates an upcoming fixture whose score fields are ignored.
    public MatchStatus Status { get; set; } = MatchStatus.Played;
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public bool IsHome { get; set; }
    public string? SetScores { get; set; }
    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }
    public string? OpponentFormation { get; set; }
    public string? ScoutingNotes { get; set; }
    // Solo matches only: "how did I play?" (1-10) — stored as the athlete's own PlayerMatchRating.
    public decimal? PersonalRating { get; set; }
}

public class CreatePlayerMatchRatingDto
{
    public int PlayerId { get; set; }
    public decimal Rating { get; set; }
    public string? StatJson { get; set; }
    // Legacy soccer fields (optional — sent by the soccer form for backward compat).
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
