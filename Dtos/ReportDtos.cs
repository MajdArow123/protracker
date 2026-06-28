namespace ProTracker.Dtos;

public class PlayerReportDto
{
    public PlayerProfileDto Player { get; set; } = null!;
    public List<PlayerAssessmentDto> Assessments { get; set; } = new();
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<InjuryRecordDto> Injuries { get; set; } = new();
    public List<MatchPerformanceDto> RecentMatches { get; set; } = new();
}

public class PlayerAverageScoreDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public double AverageScore { get; set; }
}

public class TeamReportDto
{
    public TeamDto Team { get; set; } = null!;
    public int PlayerCount { get; set; }
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<PlayerDto> Players { get; set; } = new();
    public List<PlayerAverageScoreDto> PlayerAverageScores { get; set; } = new();
    public int ActiveInjuryCount { get; set; }
    public List<InjuryRecordDto> ActiveInjuries { get; set; } = new();
}
