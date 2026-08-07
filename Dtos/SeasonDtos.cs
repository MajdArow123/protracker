namespace ProTracker.Dtos;

// A season's participating team (S5: the honest multi-team representation that
// replaced the single-team TeamId/TeamName wire shim).
public class SeasonTeamRefDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class SeasonDto
{
    public int Id { get; set; }
    public List<SeasonTeamRefDto> Teams { get; set; } = new();
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = "";
    public string? Goals { get; set; }
    public int LinkedPeriodCount { get; set; }
}

public class CreateSeasonDto
{
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    // Full lifecycle (Draft/Active/Completed/Archived). Replaced the IsActive shim,
    // which could only ever produce Active/Draft — Completed and Archived were
    // unreachable through the API before S5. Null/empty = Draft on create, unchanged
    // on update; an unknown value is a 400, never silently ignored.
    public string? Status { get; set; }
    public string? Goals { get; set; }
}

// Phase 10 S5: how many rows are currently STAMPED to this season (row-level SeasonId,
// the S3/S4 mechanism — NOT the period-linkage summary). Powers the edit-dates warning:
// stamps are not re-resolved when a season's window changes until S7 backfill tooling.
public class SeasonStampedCountsDto
{
    public int SeasonId { get; set; }
    public int Matches { get; set; }
    public int Assessments { get; set; }
    public int ObjectiveTests { get; set; }
    public int EvidenceScores { get; set; }
    public int MatchPerformances { get; set; }
    public int Lineups { get; set; }
    public int TrainingSessions { get; set; }
    public int ScheduledSessions { get; set; }
    public int ImprovementPlans { get; set; }
    public int Total => Matches + Assessments + ObjectiveTests + EvidenceScores
        + MatchPerformances + Lineups + TrainingSessions + ScheduledSessions + ImprovementPlans;
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

// Phase 10 S3/S3+: attached to a create or update RESPONSE when season resolution was
// Ambiguous ("AmbiguousSeason", candidates listed), or when a date-changing update moved
// a previously stamped record outside all seasons ("SeasonUnstamped", no candidates).
// The record saved fine (SeasonId null); this is a non-blocking nudge so the UI can
// tell the coach what happened. Never an error, never blocks.
public class SeasonResolutionNoticeDto
{
    public string Code { get; set; } = "AmbiguousSeason";
    public List<int> CandidateSeasonIds { get; set; } = new();
}
