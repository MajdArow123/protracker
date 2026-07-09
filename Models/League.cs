using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum LeagueType { League, Tournament, Cup }

public enum LeagueFormat { RoundRobin, Knockout, GroupStageKnockout, Swiss }

public enum LeagueStatus { Draft, Registration, Active, Completed, Cancelled }

public enum LeagueTeamStatus { Pending, Approved, Rejected }

public enum LeagueMatchStatus { Scheduled, Live, Completed, Postponed, Cancelled }

// A competition organized by a coach — a season-long league, a knockout tournament, or a cup.
public class League
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";
    public string? Description { get; set; }

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    // ApplicationUser id of the coach who created/runs the league.
    public string OrganizerId { get; set; } = "";

    public LeagueType Type { get; set; } = LeagueType.League;
    public LeagueFormat Format { get; set; } = LeagueFormat.RoundRobin;
    public LeagueStatus Status { get; set; } = LeagueStatus.Draft;

    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    public int? MaxTeams { get; set; }
    public bool IsPublic { get; set; }
    public string? Location { get; set; }
    public string? Rules { get; set; }
    public string? PrizeDescription { get; set; }

    // Points system (configurable per league).
    public int PointsWin { get; set; } = 3;
    public int PointsDraw { get; set; } = 1;
    public int PointsLoss { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<LeagueTeam> Teams { get; set; } = new();
    public List<LeagueMatch> Matches { get; set; } = new();
    public List<LeagueStanding> Standings { get; set; } = new();
}

// A team's registration in a league (needs organizer approval).
public class LeagueTeam
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public League League { get; set; } = null!;

    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    // ApplicationUser id of the coach who registered the team.
    public string CoachId { get; set; } = "";

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public LeagueTeamStatus Status { get; set; } = LeagueTeamStatus.Pending;
}

// A fixture between two registered teams.
public class LeagueMatch
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public League League { get; set; } = null!;

    // FK to LeagueTeam (the registration), not Team.
    public int HomeTeamId { get; set; }
    public LeagueTeam HomeTeam { get; set; } = null!;

    public int AwayTeamId { get; set; }
    public LeagueTeam AwayTeam { get; set; } = null!;

    public DateTime? ScheduledAt { get; set; }

    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }

    // Sport-aware detailed score (sets/games), e.g. "25-20, 25-18, 23-25, 25-22".
    public string? SetScores { get; set; }

    public LeagueMatchStatus Status { get; set; } = LeagueMatchStatus.Scheduled;

    public int? Round { get; set; }   // knockout / round-robin round number
    public string? Group { get; set; } // group-stage label
    public string? Venue { get; set; }
    public string? Notes { get; set; }
}

// A team's computed position in the league table.
public class LeagueStanding
{
    public int Id { get; set; }

    public int LeagueId { get; set; }
    public League League { get; set; } = null!;

    public int LeagueTeamId { get; set; }
    public LeagueTeam LeagueTeam { get; set; } = null!;

    public int Played { get; set; }
    public int Won { get; set; }
    public int Drawn { get; set; }
    public int Lost { get; set; }

    // Sport-aware: goals / points / sets scored & conceded.
    public int GoalsFor { get; set; }
    public int GoalsAgainst { get; set; }

    public int Points { get; set; }

    // Last-5 results as "WWDLL" (oldest→newest).
    public string? Form { get; set; }

    public int Position { get; set; }
}
