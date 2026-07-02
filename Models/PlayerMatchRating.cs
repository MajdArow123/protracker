using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public class PlayerMatchRating
{
    public int Id { get; set; }

    public int MatchResultId { get; set; }
    public MatchResult MatchResult { get; set; } = null!;

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    // 1-10 in 0.5 steps, consistent with PlayerStatScore.
    [Range(1, 10)]
    [Column(TypeName = "decimal(3,1)")]
    public decimal Rating { get; set; }

    public int Goals { get; set; }
    public int Assists { get; set; }
    public int YellowCards { get; set; }
    public int RedCards { get; set; }
    public int MinutesPlayed { get; set; }
    public string? Notes { get; set; }
}
