namespace ProTracker.Dtos;

public class SeasonDto
{
    public int Id { get; set; }
    // TEMPORARY wire-compat shim (TeamId/TeamName/IsActive) for the single-team-era UI —
    // remove in Phase 10 S5 when the Seasons UI moves to account level. TeamId/TeamName
    // derive from the season's SINGLE SeasonTeam row and are null when it has more than
    // one (never "the first row"); IsActive derives from Status == Active.
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = "";
    public bool IsActive { get; set; }
    public string? Goals { get; set; }
    public int LinkedPeriodCount { get; set; }
}

public class CreateSeasonDto
{
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; }
    public string? Goals { get; set; }
}

// One assessment period's team-wide average, used inside a season summary.
public class SeasonPeriodPointDto
{
    public int PeriodId { get; set; }
    public string PeriodName { get; set; } = "";
    public DateTime StartDate { get; set; }
    public double Average { get; set; }
    public bool IsLinked { get; set; }
}

public class SeasonSummaryDto
{
    public int SeasonId { get; set; }
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool HasData { get; set; }

    public string? StartPeriodName { get; set; }
    public string? EndPeriodName { get; set; }
    public double StartAverage { get; set; }
    public double EndAverage { get; set; }
    public double Improvement { get; set; }

    // Per-category start → end averages (only categories present in both endpoints).
    public List<SeasonCategoryTrendDto> CategoryTrends { get; set; } = new();

    // Every period considered in the summary, oldest first — powers a small trend line.
    public List<SeasonPeriodPointDto> Points { get; set; } = new();
}

public class SeasonCategoryTrendDto
{
    public string Category { get; set; } = "";
    public double StartAverage { get; set; }
    public double EndAverage { get; set; }
    public double Improvement { get; set; }
}

// Phase 10 S3: attached to a create RESPONSE when season resolution was Ambiguous —
// the record saved fine (SeasonId null); this is a non-blocking nudge so the UI can
// tell the coach to fix the overlapping season dates. Never an error, never blocks.
public class SeasonResolutionNoticeDto
{
    public string Code { get; set; } = "AmbiguousSeason";
    public List<int> CandidateSeasonIds { get; set; } = new();
}
