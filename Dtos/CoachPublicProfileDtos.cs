namespace ProTracker.Dtos;

// The coach's own editable public-profile settings (returned from GET/PUT
// /api/profile/coach-public). Includes the derived stats so the coach can preview.
public class CoachPublicProfileSettingsDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? ProfilePictureUrl { get; set; }
    public string? Bio { get; set; }
    public int? SportId { get; set; }
    public string? SportName { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public int? YearsCoaching { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }
    public bool IsAcceptingAthletes { get; set; }
    public string? ContactEmail { get; set; }
    public bool IsPublic { get; set; }

    // Derived.
    public int TeamCount { get; set; }
    public int PlayerCount { get; set; }
    public double? AverageTeamScore { get; set; }
}

public class UpdateCoachPublicProfileDto
{
    public string? Bio { get; set; }
    public int? SportId { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public int? YearsCoaching { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }
    public bool IsAcceptingAthletes { get; set; }
    public string? ContactEmail { get; set; }
    public bool IsPublic { get; set; }
}

// One card in the public marketplace listing.
public class CoachMarketplaceItemDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? ProfilePictureUrl { get; set; }
    public int? SportId { get; set; }
    public string? SportName { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public int? YearsCoaching { get; set; }
    public string? Specialization { get; set; }
    public bool IsAcceptingAthletes { get; set; }
    public int TeamCount { get; set; }
    public int PlayerCount { get; set; }
    public double? AverageRating { get; set; }
    public int ReviewCount { get; set; }
}

// The full public coach profile at /api/coaches/{slug}.
public class CoachPublicProfileDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? ProfilePictureUrl { get; set; }
    public int? SportId { get; set; }
    public string? SportName { get; set; }
    public string? Bio { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public int? YearsCoaching { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }
    public bool IsAcceptingAthletes { get; set; }
    public string? ContactEmail { get; set; }

    // Derived stats.
    public int TeamCount { get; set; }
    public int PlayerCount { get; set; }
    public double? AverageTeamScore { get; set; }
    public double? AverageRating { get; set; }
    public int ReviewCount { get; set; }
}
