using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// Explicit roster status, set by the coach (previously only derivable from injury records).
public enum PlayerStatus
{
    Active,
    Injured,
    Suspended,
    Inactive
}

// Coach-entered, soccer-relevant. Null = not set (never guessed).
public enum PreferredFoot
{
    Left,
    Right,
    Both
}

public class Player
{
    public int Id { get; set; }

    [Required]
    public string FullName { get; set; } = "";

    public int Age { get; set; }

    // Centimeters / kilograms.
    public double Height { get; set; }
    public double Weight { get; set; }

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    // Null for solo athletes (no team until they connect to a coach via a join code).
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public int PositionId { get; set; }
    public Position Position { get; set; } = null!;

    // 1-10 scale, consistent with PlayerStatScore.Score and MatchPerformance.PerformanceRating.
    // Nullable since the tactical layer: null = "not recorded" — a value here is a real
    // coach entry, never a registration default (register flows used to fabricate 5).
    [Range(1, 10)]
    public int? FitnessLevel { get; set; }

    // Coach-entered tactical attributes (lineup program Phase 3). Both optional.
    public PreferredFoot? PreferredFoot { get; set; }

    // Comma-separated Position ids (same-sport only, validated in PlayerService;
    // the Drill.SportIds storage precedent — never SQL-filtered, parsed in memory).
    public string? SecondaryPositionIds { get; set; }

    public string? InjuryNotes { get; set; }
    public string? Goals { get; set; }
    public string? CoachNotes { get; set; }
    public string? ProfileImageUrl { get; set; }

    // Set only if this player also has a login (ApplicationUser) of their own.
    public string? UserId { get; set; }

    // Known only for self-enrolled athletes (join-code registration); coach-created players
    // just have Age. When set, Age is derived from it.
    public DateTime? DateOfBirth { get; set; }

    public int? JerseyNumber { get; set; }

    public PlayerStatus Status { get; set; } = PlayerStatus.Active;

    // Set when the athlete self-enrolled via a team join code — used to surface a
    // "new athlete joined" notification to the coach. Null for coach-created players.
    public DateTime? JoinedViaCodeAt { get; set; }

    // Solo athlete mode: a self-managed player with no team/coach. SoloUserId mirrors
    // UserId while solo (kept even after joining a team, as a record of solo origin).
    public bool IsSolo { get; set; }
    public string? SoloUserId { get; set; }
}
