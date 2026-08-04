using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

// Lifecycle of a season. Overlapping Active seasons on one owner are allowed by design —
// "current" is not a status question, it's ApplicationUser.CurrentSeasonId.
public enum SeasonStatus
{
    Draft = 0,
    Active = 1,
    Completed = 2,
    Archived = 3,
}

// A competitive season (e.g. "2025/26 Season"). Owned by an ACCOUNT (coach/solo user),
// not a team — teams participate via SeasonTeam rows, so one season can span several
// teams and a team can appear in several (possibly overlapping) seasons. Assessment
// periods can be linked to a season so the app can report how the squad's scores moved
// from the start to the end of the season.
public class Season
{
    public int Id { get; set; }

    // The owning account. Governs create/edit/lifecycle only — read access follows
    // team participation (SeasonTeam -> CoachTeamScope).
    public string OwnerId { get; set; } = "";
    public ApplicationUser Owner { get; set; } = null!;

    [Required]
    public string Name { get; set; } = "";

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public SeasonStatus Status { get; set; } = SeasonStatus.Draft;

    public string? Goals { get; set; }

    public List<AssessmentPeriod> AssessmentPeriods { get; set; } = new();
    public List<SeasonTeam> SeasonTeams { get; set; } = new();
}
