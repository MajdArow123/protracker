namespace ProTracker.Dtos;

public class AssessmentPeriodDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int TeamId { get; set; }
    public int? SeasonId { get; set; }
}

public class CreateAssessmentPeriodDto
{
    public string Name { get; set; } = "";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int TeamId { get; set; }
}

public class PlayerAssessmentDto
{
    public int Id { get; set; }
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

public class CreatePlayerStatScoreDto
{
    public int PlayerAssessmentId { get; set; }
    public int SportStatCategoryId { get; set; }
    public decimal Score { get; set; }
}
