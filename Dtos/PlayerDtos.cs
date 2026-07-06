namespace ProTracker.Dtos;

public class PlayerDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public int Age { get; set; }
    public double Height { get; set; }
    public double Weight { get; set; }
    public int SportId { get; set; }
    // Null for solo athletes (no team until they connect to a coach).
    public int? TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public bool IsSolo { get; set; }
    public int PositionId { get; set; }
    public string PositionName { get; set; } = "";
    public int FitnessLevel { get; set; }
    public string? ProfileImageUrl { get; set; }
    public int? JerseyNumber { get; set; }
    public string Status { get; set; } = "Active";
    // Set only for athletes who self-enrolled via a team join code.
    public DateTime? JoinedViaCodeAt { get; set; }
}

// Full detail view for a single player's profile page.
public class PlayerProfileDto : PlayerDto
{
    public string? InjuryNotes { get; set; }
    public string? Goals { get; set; }
    public string? CoachNotes { get; set; }
    public string? UserId { get; set; }
}

public class PlayerCreateDto
{
    public string FullName { get; set; } = "";
    public int Age { get; set; }
    public double Height { get; set; }
    public double Weight { get; set; }
    public int TeamId { get; set; }
    public int PositionId { get; set; }
    public int FitnessLevel { get; set; }
    public int? JerseyNumber { get; set; }
    // Enum name; null/empty keeps the default (Active).
    public string? Status { get; set; }
    public string? InjuryNotes { get; set; }
    public string? Goals { get; set; }
    public string? CoachNotes { get; set; }
    public string? ProfileImageUrl { get; set; }
}

public class PlayerUpdateDto
{
    public string FullName { get; set; } = "";
    public int Age { get; set; }
    public double Height { get; set; }
    public double Weight { get; set; }
    public int PositionId { get; set; }
    public int FitnessLevel { get; set; }
    public int? JerseyNumber { get; set; }
    // Enum name; null/empty leaves the current status unchanged.
    public string? Status { get; set; }
    public string? InjuryNotes { get; set; }
    public string? Goals { get; set; }
    public string? CoachNotes { get; set; }
    public string? ProfileImageUrl { get; set; }
}
