namespace ProTracker.Dtos;

public class PlayerReportDto
{
    public PlayerProfileDto Player { get; set; } = null!;
    public List<PlayerAssessmentDto> Assessments { get; set; } = new();
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<InjuryRecordDto> Injuries { get; set; } = new();
    public List<MatchPerformanceDto> RecentMatches { get; set; } = new();
}

public class PlayerAverageScoreDto
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public double AverageScore { get; set; }
    // §5h: stamped-record counts, populated ONLY on season-filtered reports (null
    // career-wide — the unfiltered report is deliberately unchanged, Q6).
    public int? AssessmentCount { get; set; }
    public int? ObjectiveTestCount { get; set; }
    public int? MatchPerformanceCount { get; set; }
}

// §5h: stamped team-context record counts for the filtered season (Q2 — pure
// TeamId + SeasonId stamp queries, no roster involvement).
public class SeasonRecordCountsDto
{
    public int Matches { get; set; }
    public int TrainingSessions { get; set; }
    public int ScheduledSessions { get; set; }
}

public class TeamReportDto
{
    public TeamDto Team { get; set; } = null!;
    public int PlayerCount { get; set; }
    public Dictionary<string, double> AverageScoreByCategory { get; set; } = new();
    public List<PlayerDto> Players { get; set; } = new();
    public List<PlayerAverageScoreDto> PlayerAverageScores { get; set; } = new();
    public int ActiveInjuryCount { get; set; }
    public List<InjuryRecordDto> ActiveInjuries { get; set; } = new();
    // §5h — season-filtered ONLY (all null career-wide; the unfiltered report is
    // unchanged by ruling Q6). The old RosterIsCurrentNotHistorical flag is GONE:
    // the filtered report is now genuinely historical (stint roster + stamps).
    public SeasonRecordCountsDto? SeasonRecords { get; set; }
    // "Stints decide the roster listing" (Q2) — arm-1 rows with their dates.
    public List<SeasonRosterStintDto>? SeasonRoster { get; set; }
    // Q4: records not assigned to any season (team-context + population
    // player-context), disclosed rather than silently absent.
    public int? UnassignedCount { get; set; }
}
