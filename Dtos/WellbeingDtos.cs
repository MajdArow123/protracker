namespace ProTracker.Dtos;

public class WellbeingCheckinDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public DateTime Date { get; set; }
    public int Feeling { get; set; }
    public int Energy { get; set; }
    public int Sleep { get; set; }
    public bool HasPain { get; set; }
    public string? PainArea { get; set; }
    public string? PainNote { get; set; }
    public string? Notes { get; set; }
    // Average of the three 1-5 scales, rescaled to a 0-10 wellbeing score for charts.
    public double Score { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateWellbeingCheckinDto
{
    public int Feeling { get; set; }
    public int Energy { get; set; }
    public int Sleep { get; set; }
    public bool HasPain { get; set; }
    public string? PainArea { get; set; }
    public string? PainNote { get; set; }
    public string? Notes { get; set; }
}

// Coach view: a single player's daily check-ins over a window (default 30 days) plus averages.
public class PlayerWellbeingTrendDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public List<WellbeingCheckinDto> Checkins { get; set; } = new();
    public double? AvgFeeling { get; set; }
    public double? AvgEnergy { get; set; }
    public double? AvgSleep { get; set; }
    public double? AvgScore { get; set; }
    public int PainDays { get; set; }
}

// One row in the coach's Team Wellbeing card: a player's most recent check-in (if any) plus
// a flag if they reported pain while carrying an active injury / recovery plan.
public class TeamWellbeingPlayerDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public string TeamName { get; set; } = "";
    public WellbeingCheckinDto? LatestCheckin { get; set; }
    public bool CheckedInToday { get; set; }
    // True when the latest check-in reports pain AND the player has an active injury/recovery plan.
    public bool PainDuringRecovery { get; set; }
}

public class TeamWellbeingSummaryDto
{
    public List<TeamWellbeingPlayerDto> Players { get; set; } = new();
    public int TotalPlayers { get; set; }
    public int CheckedInToday { get; set; }
    public double? AvgScoreToday { get; set; }
    public int PainAlerts { get; set; }
}
