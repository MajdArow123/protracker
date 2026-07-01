using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum InjurySeverity
{
    Minor,
    Moderate,
    Severe
}

public enum RecoveryStatus
{
    Active,
    Recovering,
    FullyRecovered
}

public class InjuryRecord
{
    public int Id { get; set; }

    public int PlayerId { get; set; }
    public Player Player { get; set; } = null!;

    public DateTime InjuryDate { get; set; }

    [Required]
    public string InjuryType { get; set; } = "";

    public InjurySeverity Severity { get; set; }
    public RecoveryStatus RecoveryStatus { get; set; }
    public string? Notes { get; set; }
    public DateTime? ExpectedReturnDate { get; set; }

    // Phase 9 additions
    public string? BodyPart { get; set; }
    public string? TreatmentPlan { get; set; }
    public DateTime? RecoveredDate { get; set; }
}
