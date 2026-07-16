namespace ProTracker.Dtos;

public class LineupSlotDto
{
    public string SlotKey { get; set; } = string.Empty;
    public int PlayerId { get; set; }
}

public class LineupDto
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public int? MatchResultId { get; set; }
    public string Formation { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public List<LineupSlotDto> Slots { get; set; } = new();
}

/// <summary>Upsert payload — the (TeamId from route, MatchResultId) pair is the key.</summary>
public class SaveLineupDto
{
    public int? MatchResultId { get; set; }
    public string Formation { get; set; } = string.Empty;
    public List<LineupSlotDto> Slots { get; set; } = new();
}
