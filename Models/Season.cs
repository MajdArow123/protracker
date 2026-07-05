using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// A competitive season for a team (e.g. "2025/26 Season"). Assessment periods can be linked
// to a season so the app can report how the squad's scores moved from the start to the end
// of the season. One season per team is typically marked IsActive (the "current" season).
public class Season
{
    public int Id { get; set; }

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [Required]
    public string Name { get; set; } = "";

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    // The current season for the team. Setting one active deactivates the others on that team.
    public bool IsActive { get; set; }

    public string? Goals { get; set; }

    public List<AssessmentPeriod> AssessmentPeriods { get; set; } = new();
}
