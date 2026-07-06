using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class AssessmentPeriod
{
    public int Id { get; set; }

    // Free-form label, e.g. "Weekly", "Monthly", "Custom", "Week 1".
    [Required]
    public string Name { get; set; } = "";

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    // Exactly one of TeamId / PlayerId is set: team-scoped periods are the coach flow,
    // player-scoped periods belong to a solo athlete ("Personal Training").
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    public int? PlayerId { get; set; }
    public Player? Player { get; set; }

    // Optional link to a Season, so a season summary can span the periods within it.
    public int? SeasonId { get; set; }
    public Season? Season { get; set; }

    public List<PlayerAssessment> PlayerAssessments { get; set; } = new();
}
