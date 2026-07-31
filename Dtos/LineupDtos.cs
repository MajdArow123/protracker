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
    public string? Name { get; set; }
    public string Formation { get; set; } = string.Empty;

    /// <summary>Enum name ("Draft" | "Published") — the NotificationDto.Type precedent.</summary>
    public string Status { get; set; } = "Draft";
    public DateTime? PublishedAt { get; set; }

    /// <summary>Current optimistic-concurrency version; echo as BaseVersion on save.</summary>
    public int Version { get; set; }

    public DateTime UpdatedAt { get; set; }

    /// <summary>Display name of the last editor (read-time join); null if unknown.</summary>
    public string? UpdatedByName { get; set; }
    public int? CaptainPlayerId { get; set; }
    public int? ViceCaptainPlayerId { get; set; }
    public string? Notes { get; set; }
    public List<string> TacticalLabels { get; set; } = new();
    public List<LineupSlotDto> Slots { get; set; } = new();
    public List<SetPieceAssignmentDto> SetPieces { get; set; } = new();
}

/// <summary>
/// Upsert payload. Key = (TeamId from route, MatchResultId) for match lineups,
/// or (TeamId, Name) for team lineups (Name null = default XI). BaseVersion
/// must match the server's Version when the row exists — stale or missing → 409.
/// </summary>
public class SaveLineupDto
{
    public int? MatchResultId { get; set; }
    public string? Name { get; set; }
    public int? BaseVersion { get; set; }
    public string Formation { get; set; } = string.Empty;
    public int? CaptainPlayerId { get; set; }
    public int? ViceCaptainPlayerId { get; set; }
    public string? Notes { get; set; }
    public List<string>? TacticalLabels { get; set; }
    public List<LineupSlotDto> Slots { get; set; } = new();
    public List<SetPieceAssignmentDto>? SetPieces { get; set; } = new();
}

/// <summary>One row of GET /api/teams/{id}/lineups — every saved lineup for the team.</summary>
public class LineupSummaryDto
{
    public int Id { get; set; }
    public int? MatchResultId { get; set; }
    public string? Name { get; set; }
    public string Formation { get; set; } = string.Empty;
    public string Status { get; set; } = "Draft";
    public DateTime? PublishedAt { get; set; }
    public int Version { get; set; }
    public int SlotCount { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? UpdatedByName { get; set; }
}

/// <summary>One lightweight audit row: who / when / real-diff summary.</summary>
public class LineupAuditEntryDto
{
    public int Id { get; set; }
    public int? LineupId { get; set; }
    public string KeyLabel { get; set; } = "";
    public string ChangedByName { get; set; } = "";
    public string Action { get; set; } = "";
    public int Version { get; set; }
    public string Summary { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
