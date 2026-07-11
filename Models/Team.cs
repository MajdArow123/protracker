using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class Team
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    // Owning coach. CoachTeamScope is the actual access-control mechanism
    // (it supports multiple coaches per team); this is the primary owner.
    [Required]
    public string CoachId { get; set; } = "";

    // Team photo (400px square JPEG as a base64 data URL), uploaded by the coach.
    public string? PhotoUrl { get; set; }

    public int? FoundedYear { get; set; }
    public string? Description { get; set; }

    // Which benchmark calibration this team's evidence scores use (age group /
    // competition level). Null = the sport's metric-definition defaults.
    public int? BenchmarkProfileId { get; set; }
    public BenchmarkProfile? BenchmarkProfile { get; set; }

    public List<Player> Players { get; set; } = new();
    public List<CoachTeamScope> CoachScopes { get; set; } = new();
    public List<AssessmentPeriod> AssessmentPeriods { get; set; } = new();
}
