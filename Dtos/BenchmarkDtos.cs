namespace ProTracker.Dtos;

public class BenchmarkValueDto
{
    public int MetricDefinitionId { get; set; }
    public string MetricName { get; set; } = "";
    public string? Unit { get; set; }
    public string InputType { get; set; } = "";
    public decimal BenchmarkLow { get; set; }
    public decimal BenchmarkMid { get; set; }
    public decimal BenchmarkHigh { get; set; }
    public string? Notes { get; set; }
}

public class BenchmarkProfileDto
{
    public int Id { get; set; }
    public int SportId { get; set; }
    public string Name { get; set; } = "";
    public int? AgeGroupMin { get; set; }
    public int? AgeGroupMax { get; set; }
    public string CompetitionLevel { get; set; } = "";
    public bool IsDefault { get; set; }
    // True when the calling coach owns this profile (editable).
    public bool IsMine { get; set; }
    public List<BenchmarkValueDto> Values { get; set; } = new();
}

public class CreateBenchmarkValueDto
{
    public int MetricDefinitionId { get; set; }
    public decimal BenchmarkLow { get; set; }
    public decimal BenchmarkMid { get; set; }
    public decimal BenchmarkHigh { get; set; }
    public string? Notes { get; set; }
}

public class CreateBenchmarkProfileDto
{
    public int SportId { get; set; }
    public string Name { get; set; } = "";
    public int? AgeGroupMin { get; set; }
    public int? AgeGroupMax { get; set; }
    public string CompetitionLevel { get; set; } = "Amateur";
    // Copy starting values from an existing profile (else metric-definition defaults).
    public int? BasedOnProfileId { get; set; }
    // Explicit values (used on update / when the UI sends edited anchors).
    public List<CreateBenchmarkValueDto>? Values { get; set; }
}

public class SetTeamBenchmarkProfileDto
{
    // Null clears the calibration (back to sport defaults).
    public int? BenchmarkProfileId { get; set; }
}

public class TeamBenchmarkProfileDto
{
    public int TeamId { get; set; }
    public int? BenchmarkProfileId { get; set; }
    public string? ProfileName { get; set; }
}

// The benchmarks that actually apply to one player (their team's profile, or the
// sport defaults) — drives hints/badges in the evidence entry UI.
public class PlayerBenchmarksDto
{
    public int PlayerId { get; set; }
    public int? BenchmarkProfileId { get; set; }
    public string? ProfileName { get; set; }
    public Dictionary<int, BenchmarkValueDto> Values { get; set; } = new();
}
