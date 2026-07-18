namespace ProTracker.Dtos;

public class LineupSlotDto
{
    public string SlotKey { get; set; } = string.Empty;
    public int PlayerId { get; set; }

    /// <summary>Per-sport preset role label key (frontend-owned catalog, opaque here).</summary>
    public string? Role { get; set; }

    /// <summary>Optional coach instructions (column ships in Phase 3; UI deferred).</summary>
    public string? Instructions { get; set; }
}

/// <summary>A set-piece taker. Type is an opaque sport-aware key, like SlotKey.</summary>
public class SetPieceAssignmentDto
{
    public string Type { get; set; } = string.Empty;
    public int PlayerId { get; set; }
}

public class LineupDto
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public int? MatchResultId { get; set; }
    public string Formation { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public int? CaptainPlayerId { get; set; }
    public int? ViceCaptainPlayerId { get; set; }
    public string? Notes { get; set; }
    public List<string> TacticalLabels { get; set; } = new();
    public List<LineupSlotDto> Slots { get; set; } = new();
    public List<SetPieceAssignmentDto> SetPieces { get; set; } = new();
}

/// <summary>Upsert payload — the (TeamId from route, MatchResultId) pair is the key.</summary>
public class SaveLineupDto
{
    public int? MatchResultId { get; set; }
    public string Formation { get; set; } = string.Empty;
    public int? CaptainPlayerId { get; set; }
    public int? ViceCaptainPlayerId { get; set; }
    public string? Notes { get; set; }
    public List<string>? TacticalLabels { get; set; }
    public List<LineupSlotDto> Slots { get; set; } = new();
    public List<SetPieceAssignmentDto>? SetPieces { get; set; } = new();
}
