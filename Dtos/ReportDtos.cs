namespace ProTracker.Dtos;

public class PlayerReportDto
{
    public PlayerProfileDto Player { get; set; } = null!;
    public List<PlayerAssessmentDto> Assessments { get; set; } = new();
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<InjuryRecordDto> Injuries { get; set; } = new();
    public List<MatchPerformanceDto> RecentMatches { get; set; } = new();
}

public class TeamReportDto
{
    public TeamDto Team { get; set; } = null!;
    public int PlayerCount { get; set; }
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<PlayerDto> Players { get; set; } = new();
}
