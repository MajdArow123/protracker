namespace ProTracker.Dtos;

/// <summary>
/// A coach-owned tactical preset (Phase 6). Roles/labels are opaque frontend
/// catalog keys; the server validates shape only. No player ids by design.
/// </summary>
public class TacticalPresetDto
{
    public int Id { get; set; }
    public int SportId { get; set; }
    public string Name { get; set; } = "";
    public string? Formation { get; set; }
    public Dictionary<string, string> Roles { get; set; } = new();
    public List<string> Labels { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SaveTacticalPresetDto
{
    public int SportId { get; set; }
    public string Name { get; set; } = "";
    public string? Formation { get; set; }
    public Dictionary<string, string>? Roles { get; set; }
    public List<string>? Labels { get; set; }
}
