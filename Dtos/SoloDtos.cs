namespace ProTracker.Dtos;

// POST /api/auth/register-solo — self-managed athlete, no team/coach/join code.
public class RegisterSoloRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string FullName { get; set; } = "";
    public DateTime DateOfBirth { get; set; }
    public double Height { get; set; }  // cm
    public double Weight { get; set; }  // kg
    public int SportId { get; set; }
    public int PositionId { get; set; }
    public string SkillLevel { get; set; } = "";          // SkillLevel enum name
    public string TrainingFrequency { get; set; } = "";   // TrainingFrequency enum name
    public int? JerseyNumber { get; set; }
    public string? Goals { get; set; }
    public string? Motivation { get; set; }
    public List<DietaryRestrictionInputDto> DietaryRestrictions { get; set; } = new();
    public string? Phone { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }
}

public class RegisterSoloResponse
{
    public UserInfoDto User { get; set; } = null!;
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public int PlayerId { get; set; }
    public string SportName { get; set; } = "";
}

public class SoloProfileDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int SportId { get; set; }
    public string SportName { get; set; } = "";
    public string SkillLevel { get; set; } = "";
    public string TrainingFrequency { get; set; } = "";
    public string? Goals { get; set; }
    public string? Motivation { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateSoloProfileRequest
{
    public string? SkillLevel { get; set; }
    public string? TrainingFrequency { get; set; }
    public string? Goals { get; set; }
    public string? Motivation { get; set; }
}

// Public option list for the solo registration wizard (sport step + position step).
public class SoloSportOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<PositionOptionDto> Positions { get; set; } = new();
}

// POST /api/solo/connect-coach — a solo athlete joins a team via a coach's join code.
public class ConnectCoachRequest
{
    public string Code { get; set; } = "";
}

// The role changes SoloAthlete → Athlete, so fresh tokens are issued (like a login).
public class ConnectCoachResponse
{
    public UserInfoDto User { get; set; } = null!;
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public string TeamName { get; set; } = "";
    public int TeamId { get; set; }
    public int PlayerId { get; set; }
}
