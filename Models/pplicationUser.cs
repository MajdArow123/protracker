using Microsoft.AspNetCore.Identity;

namespace ProTracker.Models;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
}