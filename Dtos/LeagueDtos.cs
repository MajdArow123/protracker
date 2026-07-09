using ProTracker.Models;

namespace ProTracker.Dtos;

public class CreateLeagueDto
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SportId { get; set; }
    public LeagueType Type { get; set; } = LeagueType.League;
    public LeagueFormat Format { get; set; } = LeagueFormat.RoundRobin;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? MaxTeams { get; set; }
    public bool IsPublic { get; set; }
    public string? Location { get; set; }
    public string? Rules { get; set; }
    public string? PrizeDescription { get; set; }
    // Optional custom points; default 3/1/0 when null.
    public int? PointsWin { get; set; }
    public int? PointsDraw { get; set; }
    public int? PointsLoss { get; set; }
}

public class UpdateLeagueDto : CreateLeagueDto
{
    // Status can be advanced by the organizer (Draft → Registration → Active → Completed…).
    public LeagueStatus Status { get; set; }
}

// Card in a league listing.
public class LeagueSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SportId { get; set; }
    public string SportName { get; set; } = "";
    public string OrganizerId { get; set; } = "";
    public string OrganizerName { get; set; } = "";
    public LeagueType Type { get; set; }
    public LeagueFormat Format { get; set; }
    public LeagueStatus Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? MaxTeams { get; set; }
    public int TeamCount { get; set; } // approved teams
    public bool IsPublic { get; set; }
    public string? Location { get; set; }
    public bool IsOrganizer { get; set; }
    public bool IsRegistered { get; set; } // caller's team is approved/pending
}

public class LeagueDetailDto : LeagueSummaryDto
{
    public string? Rules { get; set; }
    public string? PrizeDescription { get; set; }
    public int PointsWin { get; set; }
    public int PointsDraw { get; set; }
    public int PointsLoss { get; set; }
    public string ScoreFormat { get; set; } = ""; // Goals/Points/Sets/GamesAndSets
    public List<LeagueTeamDto> Teams { get; set; } = new();
    public List<LeagueStandingDto> Standings { get; set; } = new();
}

public class LeagueTeamDto
{
    public int Id { get; set; } // LeagueTeam id
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public string? TeamPhotoUrl { get; set; }
    public string CoachId { get; set; } = "";
    public string CoachName { get; set; } = "";
    public LeagueTeamStatus Status { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsMine { get; set; } // caller's team
}

public class RegisterLeagueTeamDto
{
    public int TeamId { get; set; }
}

public class LeagueStandingDto
{
    public int LeagueTeamId { get; set; }
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public string? TeamPhotoUrl { get; set; }
    public int Position { get; set; }
    public int Played { get; set; }
    public int Won { get; set; }
    public int Drawn { get; set; }
    public int Lost { get; set; }
    public int GoalsFor { get; set; }
    public int GoalsAgainst { get; set; }
    public int GoalDifference => GoalsFor - GoalsAgainst;
    public int Points { get; set; }
    public string? Form { get; set; }
    public bool IsMine { get; set; }
}

public class LeagueMatchDto
{
    public int Id { get; set; }
    public int LeagueId { get; set; }
    public int HomeTeamId { get; set; }   // LeagueTeam id
    public int AwayTeamId { get; set; }
    public string HomeTeamName { get; set; } = "";
    public string AwayTeamName { get; set; } = "";
    public string? HomeTeamPhotoUrl { get; set; }
    public string? AwayTeamPhotoUrl { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public string? SetScores { get; set; }
    public LeagueMatchStatus Status { get; set; }
    public int? Round { get; set; }
    public string? Group { get; set; }
    public string? Venue { get; set; }
    public string? Notes { get; set; }
}

public class CreateLeagueMatchDto
{
    public int HomeTeamId { get; set; } // LeagueTeam id
    public int AwayTeamId { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public int? Round { get; set; }
    public string? Group { get; set; }
    public string? Venue { get; set; }
    public string? Notes { get; set; }
}

public class UpdateLeagueMatchScoreDto
{
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public string? SetScores { get; set; }
    public LeagueMatchStatus Status { get; set; } = LeagueMatchStatus.Completed;
}
