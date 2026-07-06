namespace ProTracker.Dtos;

public class TeamJoinCodeDto
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public string Code { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? MaxUses { get; set; }
    public int UseCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class GenerateJoinCodeRequest
{
    // Both optional: null = never expires / unlimited uses.
    public int? ExpiresInDays { get; set; }
    public int? MaxUses { get; set; }
}

public class PositionOptionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

// Public response for GET /api/join-codes/validate/{code} — shown on the /join/{code}
// team-preview step before the athlete commits to creating an account.
public class ValidateJoinCodeResponse
{
    public bool Valid { get; set; }
    public string? Reason { get; set; } // "expired" | "inactive" | "maxed" | "notfound"
    public int TeamId { get; set; }
    public string TeamName { get; set; } = "";
    public string Sport { get; set; } = "";
    public string CoachName { get; set; } = "";
    public string Code { get; set; } = "";
    // Sport-specific positions so the registration flow can offer only valid choices.
    public List<PositionOptionDto> Positions { get; set; } = new();
}

public class DietaryRestrictionInputDto
{
    public string Type { get; set; } = "";      // NutritionPreferenceType name
    public string Category { get; set; } = "";  // NutritionCategory name
    public string? SpecificItem { get; set; }
    public string Severity { get; set; } = "";  // NutritionSeverity name
}

public class RegisterAthleteRequest
{
    public string Code { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string FullName { get; set; } = "";
    public DateTime DateOfBirth { get; set; }
    public double Height { get; set; }  // cm
    public double Weight { get; set; }  // kg
    public int PositionId { get; set; }
    public int? JerseyNumber { get; set; }
    public string? Phone { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }
    public List<DietaryRestrictionInputDto> DietaryRestrictions { get; set; } = new();
    public string? Preferences { get; set; }
}

public class RegisterAthleteResponse
{
    public UserInfoDto User { get; set; } = null!;
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public string TeamName { get; set; } = "";
    public int PlayerId { get; set; }
}

public class InviteAthleteRequest
{
    public string Email { get; set; } = "";
}

public class AthleteInviteDto
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = ""; // "Pending" | "Joined"
}

public class AthleteInviteResultDto
{
    public string Email { get; set; } = "";
    public string JoinUrl { get; set; } = "";
    public bool EmailSent { get; set; }
}
