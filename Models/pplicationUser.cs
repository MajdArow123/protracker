using Microsoft.AspNetCore.Identity;

namespace ProTracker.Models;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";

    // Collected during athlete self-enrollment (optional) and editable from the profile page.
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }

    // 400x400 JPEG stored as a base64 data URL (no persistent disk on Railway).
    public string? ProfilePictureUrl { get; set; }
    public string? Bio { get; set; } // max 500 chars, enforced in ProfileService

    // Coach-only profile fields.
    public string? CoachingExperience { get; set; }
    public string? Certifications { get; set; }
    public string? Specialization { get; set; }

    // Set once the athlete finishes (or skips) the first-login onboarding flow.
    public bool HasCompletedOnboarding { get; set; }
}