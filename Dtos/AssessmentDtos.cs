namespace ProTracker.Dtos;

public class AssessmentPeriodDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    // Team-scoped (coach flow) XOR player-scoped (solo athlete's personal periods).
    public int? TeamId { get; set; }
    public int? PlayerId { get; set; }
    public int? SeasonId { get; set; }
}

public class CreateAssessmentPeriodDto
{
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    // Omitted/null by solo athletes: the period is created against their own player.
    public int? TeamId { get; set; }
}

public class PlayerAssessmentDto
{
    public int Id { get; set; }
    // Set only on a CREATE/UPDATE response when season resolution was Ambiguous, or
    // when a date-changing update unstamped a previously stamped record — a
    // non-blocking nudge (Phase 10 S3/S3+); null on reads and on clean resolutions.
    public SeasonResolutionNoticeDto? SeasonNotice { get; set; }
    public int PlayerId { get; set; }
    public int AssessmentPeriodId { get; set; }
    public string AssessmentPeriodName { get; set; } = "";
    public DateTime DateRecorded { get; set; }
    public string? Notes { get; set; }
    public List<PlayerStatScoreDto> StatScores { get; set; } = new();
}

public class CreatePlayerAssessmentDto
{
    public int PlayerId { get; set; }
    // 0/omitted is allowed only for solo athletes: their "Personal Training" period
    // is auto-created (or reused) on save.
    public int AssessmentPeriodId { get; set; }
    public DateTime DateRecorded { get; set; }
    public string? Notes { get; set; }
    public List<CreatePlayerStatScoreDto> StatScores { get; set; } = new();
}

public class PlayerStatScoreDto
{
    public int Id { get; set; }
    public int PlayerAssessmentId { get; set; }
    public int SportStatCategoryId { get; set; }
    public string StatCategoryName { get; set; } = "";
    public decimal Score { get; set; }
}

// Bulk assessment: one period + date, many players in a single transaction.
public class BulkCreateAssessmentDto
{
    public int AssessmentPeriodId { get; set; }
    public DateTime DateRecorded { get; set; }
    public List<BulkPlayerAssessmentDto> Assessments { get; set; } = new();
}

public class BulkPlayerAssessmentDto
{
    public int PlayerId { get; set; }
    public string? Notes { get; set; }
    public List<CreatePlayerStatScoreDto> StatScores { get; set; } = new();
}

public class CreatePlayerStatScoreDto
{
    public int PlayerAssessmentId { get; set; }
    public int SportStatCategoryId { get; set; }
    public decimal Score { get; set; }
}
