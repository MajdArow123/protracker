using ProTracker.Models;

namespace ProTracker.Dtos;

public class InjuryRecordDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public DateTime InjuryDate { get; set; }
    public string InjuryType { get; set; } = "";
    public string? BodyPart { get; set; }
    public InjurySeverity Severity { get; set; }
    public RecoveryStatus RecoveryStatus { get; set; }
    public bool IsRecovered { get; set; }
    public string? Notes { get; set; }
    public string? TreatmentPlan { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
    public DateTime? RecoveredDate { get; set; }
}

public class CreateInjuryRecordDto
{
    public int PlayerId { get; set; }
    public DateTime InjuryDate { get; set; }
    public string InjuryType { get; set; } = "";
    public string? BodyPart { get; set; }
    public InjurySeverity Severity { get; set; }
    public RecoveryStatus RecoveryStatus { get; set; }
    public string? Notes { get; set; }
    public string? TreatmentPlan { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }
}
