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

// Phase 10 S6: one roster stint — a player's membership window on a team within a
// season. Multiple non-overlapping stints per (player, season) are legal (mid-season
// transfers, leave-and-rejoin); overlap within one season is a 400 (service-enforced).
public class SeasonRosterStintDto
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int? JerseyNumber { get; set; }
    public int? PositionId { get; set; }
    public string? PositionName { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
}

public class SaveSeasonRosterStintDto
{
    // Identity fields — set on create, immutable on update (a mismatch 400s; changing
    // who/where a stint was is delete + re-add, never a silent rewrite).
    public int PlayerId { get; set; }
    public int TeamId { get; set; }
    // REQUIRED (S6 ruling): an undated stint can never resolve, so allowing one creates
    // data that silently does nothing. Nullable so an absent value is an explicit 400,
    // not a bindable 0001-01-01.
    public DateTime? JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    public int? JerseyNumber { get; set; }
    public int? PositionId { get; set; }
}

// Save response (S6 ruling 3): saving a stint NEVER retroactively stamps existing
// records — but the expectation is real, so the count of this player's unstamped
// records inside the stint's effective window rides back with the save and the UI says
// backfill tooling arrives in S7.
public class SeasonRosterSaveResultDto
{
    public SeasonRosterStintDto Stint { get; set; } = null!;
    public int UnstampedInWindow { get; set; }
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

// ---- Phase 10 S7: backfill tooling ----

public class SeasonBackfillSeasonCountDto
{
    public int SeasonId { get; set; }
    public string SeasonName { get; set; } = "";
    public int Count { get; set; }
}

// One row per scoped entity type. Preview and execute share the shape: for preview the
// numbers are "would"; for execute they are what actually happened. Gap/Ambiguous are
// as prominent as the stamped counts by design — "will remain unassigned" is a first-
// class answer, not an error footnote.
public class SeasonBackfillEntityDto
{
    public string EntityType { get; set; } = "";
    public int TotalCandidates { get; set; }
    public List<SeasonBackfillSeasonCountDto> BySeason { get; set; } = new();
    public int Stamped { get; set; }
    public int Gap { get; set; }
    public int Ambiguous { get; set; }
}

public class SeasonBackfillPreviewDto
{
    public List<SeasonBackfillEntityDto> Entities { get; set; } = new();
    public int TotalCandidates { get; set; }
    public int TotalStamped { get; set; }
    public int TotalGap { get; set; }
    public int TotalAmbiguous { get; set; }
}

public class SeasonBackfillResultDto : SeasonBackfillPreviewDto
{
    public int RunId { get; set; }
    public DateTime RanAt { get; set; }
}
