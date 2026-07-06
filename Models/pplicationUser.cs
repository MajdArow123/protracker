using Microsoft.AspNetCore.Identity;

namespace ProTracker.Models;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";

    // Collected during athlete self-enrollment (optional) and editable from the profile page.
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }
}