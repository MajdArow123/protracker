using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// Enforces which coaches can access which teams/players. A team has one
// owning CoachId on Team itself, but access checks should go through this
// table so additional coaches (assistants) can be granted scope later
// without changing team ownership.
public class CoachTeamScope
{
    public int Id { get; set; }

    [Required]
    public string CoachId { get; set; } = "";

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;
}
