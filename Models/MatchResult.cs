using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum MatchOutcome
{
    Win,
    Draw,
    Loss
}

// How a match's HomeScore/AwayScore should be interpreted & displayed. Auto-detected
// from the team's sport when a match is created.
public enum ScoreFormat
{
    Goals,        // Soccer/Football — "2 - 1"
    Points,       // Basketball — "98 - 87"
    Sets,         // Volleyball / Beach Volleyball — "3 - 1" sets (+ SetScores detail)
    GamesAndSets  // Tennis — "2 - 1" sets (+ SetScores game detail)
}

// Scheduled-vs-played distinction (Phase 7 / blueprint §5b #1). A Scheduled row is
// an upcoming fixture: it has NO score — the stored 0-0 is masked to null at the
// DTO layer and never surfaces as a result. Every pre-Phase-7 row is truthfully
// Played (migration default 0).
public enum MatchStatus
{
    Played = 0,
    Scheduled = 1
}

// A team-level game result. Distinct from MatchPerformance (a single player's
// per-match rating with no team match entity). Individual ratings hang off this
// via PlayerMatchRating.
public class MatchResult
{
    public int Id { get; set; }

    // Exactly one of TeamId / PlayerId is set: team matches are the coach flow,
    // player-scoped matches are logged by a solo athlete for themselves.
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public int? PlayerId { get; set; }
    public Player? Player { get; set; }

    [Required]
    public string OpponentName { get; set; } = "";

    public DateTime MatchDate { get; set; }

    // The final/total score (goals, points, or sets won depending on ScoreFormat).
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public bool IsHome { get; set; }

    public ScoreFormat ScoreFormat { get; set; } = ScoreFormat.Goals;
    // Detailed set-by-set / quarter scores, e.g. "25-20, 25-18, 23-25, 25-22" (volleyball)
    // or "6-4, 3-6, 7-5" (tennis). Null when not applicable.
    public string? SetScores { get; set; }

    public string? Venue { get; set; }
    public string? Competition { get; set; }
    public string? Notes { get; set; }

    public MatchStatus Status { get; set; } = MatchStatus.Played;

    // Coach-entered opponent plan (Phase 7 match context). Presented in the UI with
    // the coach-entered source badge — a plan, never a recorded fact.
    public string? OpponentFormation { get; set; }
    public string? ScoutingNotes { get; set; }

    public List<PlayerMatchRating> Ratings { get; set; } = new();

    // Maps a sport (by id) to its score format.
    public static ScoreFormat FormatForSport(int sportId) => sportId switch
    {
        1 => ScoreFormat.Goals,        // Football / Soccer
        2 => ScoreFormat.Points,       // Basketball
        3 => ScoreFormat.Sets,         // Volleyball Indoor
        4 => ScoreFormat.Sets,         // Beach Volleyball
        5 => ScoreFormat.GamesAndSets, // Tennis
        _ => ScoreFormat.Points,
    };
}
