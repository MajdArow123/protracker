using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public enum CompetitionLevel
{
    Recreational,
    Amateur,
    SemiPro,
    Professional
}

// A set of benchmark anchors calibrated for an age group / competition level
// (a U14 sprinting 4.5s is excellent; a pro at 4.5s is below average). System
// defaults (CoachId null, IsDefault true) are seeded per sport; coaches can
// create custom profiles. Teams pick which profile their scores calibrate to.
public class BenchmarkProfile
{
    public int Id { get; set; }

    // Null = system-provided default profile (visible to everyone, immutable).
    public string? CoachId { get; set; }

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;

    [Required]
    public string Name { get; set; } = "";

    public int? AgeGroupMin { get; set; }
    public int? AgeGroupMax { get; set; }

    public CompetitionLevel CompetitionLevel { get; set; } = CompetitionLevel.Amateur;

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<BenchmarkValue> Values { get; set; } = new();
}

// The calibrated anchors for one metric within a profile. Metrics without a row
// fall back to the SportMetricDefinition defaults.
public class BenchmarkValue
{
    public int Id { get; set; }

    public int BenchmarkProfileId { get; set; }
    public BenchmarkProfile BenchmarkProfile { get; set; } = null!;

    public int MetricDefinitionId { get; set; }
    public SportMetricDefinition MetricDefinition { get; set; } = null!;

    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkLow { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkMid { get; set; }

    [Column(TypeName = "decimal(9,2)")]
    public decimal BenchmarkHigh { get; set; }

    public string? Notes { get; set; }
}
