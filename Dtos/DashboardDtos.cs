namespace ProTracker.Dtos;

public class CoachDashboardDto
{
    public int TotalTeams { get; set; }
    public int TotalPlayers { get; set; }
    public List<TeamDto> Teams { get; set; } = new();
}

public class PlayerDashboardDto
{
    public PlayerProfileDto Player { get; set; } = null!;
    public int TotalAssessments { get; set; }
    public double? LatestAverageScore { get; set; }
    public List<PlayerAssessmentDto> RecentAssessments { get; set; } = new();
}
