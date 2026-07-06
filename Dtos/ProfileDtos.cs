namespace ProTracker.Dtos;

// Everything the profile page needs in one call. Athlete-specific fields are null for coaches.
public class ProfileDto
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List<string> Roles { get; set; } = new();

    public string? PhoneNumber { get; set; }
    public string? Bio { get; set; }
    public string? ProfilePictureUrl { get; set; }

    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }

    // Coach-only
    public string? CoachingExperience { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }

    public bool HasCompletedOnboarding { get; set; }

    // Athlete-only (from the linked Player record)
    public int? PlayerId { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public double? Height { get; set; }
    public double? Weight { get; set; }
    public int? JerseyNumber { get; set; }
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public string? PositionName { get; set; }
    public string? SportName { get; set; }
    public int? FitnessLevel { get; set; }
}

public class ProfileUpdateRequest
{
    public string DisplayName { get; set; } = "";
    public string? PhoneNumber { get; set; }
    public string? Bio { get; set; }

    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }

    // Coach-only (ignored for athletes)
    public string? CoachingExperience { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }

    // Athlete-only (ignored for coaches; only applied when provided)
    public DateTime? DateOfBirth { get; set; }
    public double? Height { get; set; }
    public double? Weight { get; set; }
    public int? JerseyNumber { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public class DeleteAccountRequest
{
    public string Password { get; set; } = "";
}

public class ProfilePictureResponse
{
    public string? ProfilePictureUrl { get; set; }
}
