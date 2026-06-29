namespace ProTracker.Dtos;

public class AIInsightsDto
{
    public List<string> Insights { get; set; } = new();
    public string GeneratedAt { get; set; } = DateTime.UtcNow.ToString("o");
}
