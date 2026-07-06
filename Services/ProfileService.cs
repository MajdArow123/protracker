using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IProfileService
{
    Task<ProfileDto> GetAsync(ClaimsPrincipal principal);
    Task<ProfileDto> UpdateAsync(ClaimsPrincipal principal, ProfileUpdateRequest request);
    Task<string> SetPictureAsync(ClaimsPrincipal principal, IFormFile file);
    Task RemovePictureAsync(ClaimsPrincipal principal);
    Task ChangePasswordAsync(ClaimsPrincipal principal, ChangePasswordRequest request);
    Task DeleteAccountAsync(ClaimsPrincipal principal, DeleteAccountRequest request);
}

public class ProfileService : IProfileService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly IImageService _images;
    private readonly ILogger<ProfileService> _logger;

    public ProfileService(
        UserManager<ApplicationUser> userManager, ApplicationDbContext context,
        IImageService images, ILogger<ProfileService> logger)
    {
        _userManager = userManager;
        _context = context;
        _images = images;
        _logger = logger;
    }

    public async Task<ProfileDto> GetAsync(ClaimsPrincipal principal)
    {
        var user = await RequireUserAsync(principal);
        var roles = await _userManager.GetRolesAsync(user);
        return await ToDtoAsync(user, roles);
    }

    public async Task<ProfileDto> UpdateAsync(ClaimsPrincipal principal, ProfileUpdateRequest request)
    {
        var user = await RequireUserAsync(principal);
        var roles = await _userManager.GetRolesAsync(user);

        if (string.IsNullOrWhiteSpace(request.DisplayName))
            throw new ValidationApiException("Name cannot be empty.");
        if (request.Bio is { Length: > 500 })
            throw new ValidationApiException("Bio must be 500 characters or fewer.");

        user.DisplayName = request.DisplayName.Trim();
        user.PhoneNumber = NullIfBlank(request.PhoneNumber);
        user.Bio = NullIfBlank(request.Bio);
        user.EmergencyContactName = NullIfBlank(request.EmergencyContactName);
        user.EmergencyContactPhone = NullIfBlank(request.EmergencyContactPhone);
        user.EmergencyContactRelationship = NullIfBlank(request.EmergencyContactRelationship);

        if (roles.Contains("Coach"))
        {
            user.CoachingExperience = NullIfBlank(request.CoachingExperience);
            user.Certifications = NullIfBlank(request.Certifications);
            user.Specialization = NullIfBlank(request.Specialization);
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new ValidationApiException(result.Errors.Select(e => e.Description));

        // Athletes may edit their own physicals — these live on the Player record so the
        // coach's views stay in sync.
        if (roles.Contains("Athlete"))
        {
            var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == user.Id);
            if (player != null)
            {
                player.FullName = user.DisplayName; // keep roster name aligned with account name
                if (request.DateOfBirth.HasValue)
                {
                    var age = ComputeAge(request.DateOfBirth.Value);
                    if (age < 5 || age > 90) throw new ValidationApiException("Please enter a valid date of birth.");
                    player.DateOfBirth = request.DateOfBirth;
                    player.Age = age;
                }
                if (request.Height.HasValue)
                {
                    if (request.Height is < 80 or > 250) throw new ValidationApiException("Height must be between 80 and 250 cm.");
                    player.Height = request.Height.Value;
                }
                if (request.Weight.HasValue)
                {
                    if (request.Weight is < 20 or > 250) throw new ValidationApiException("Weight must be between 20 and 250 kg.");
                    player.Weight = request.Weight.Value;
                }
                if (request.JerseyNumber.HasValue)
                {
                    if (request.JerseyNumber is < 0 or > 999) throw new ValidationApiException("Jersey number must be between 0 and 999.");
                    player.JerseyNumber = request.JerseyNumber;
                }
                await _context.SaveChangesAsync();
            }
        }

        return await ToDtoAsync(user, roles);
    }

    public async Task<string> SetPictureAsync(ClaimsPrincipal principal, IFormFile file)
    {
        var user = await RequireUserAsync(principal);
        var dataUrl = await _images.ToSquareJpegDataUrlAsync(file, 400);
        user.ProfilePictureUrl = dataUrl;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new ValidationApiException(result.Errors.Select(e => e.Description));

        // Keep the player card avatar in sync for athletes.
        var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == user.Id);
        if (player != null)
        {
            player.ProfileImageUrl = dataUrl;
            await _context.SaveChangesAsync();
        }

        return dataUrl;
    }

    public async Task RemovePictureAsync(ClaimsPrincipal principal)
    {
        var user = await RequireUserAsync(principal);
        user.ProfilePictureUrl = null;
        await _userManager.UpdateAsync(user);

        var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == user.Id);
        if (player != null && player.ProfileImageUrl != null)
        {
            player.ProfileImageUrl = null;
            await _context.SaveChangesAsync();
        }
    }

    public async Task ChangePasswordAsync(ClaimsPrincipal principal, ChangePasswordRequest request)
    {
        var user = await RequireUserAsync(principal);
        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            // "PasswordMismatch" reads poorly — translate it; pass the rest through.
            var messages = result.Errors
                .Select(e => e.Code == "PasswordMismatch" ? "Current password is incorrect." : e.Description)
                .ToList();
            throw new ValidationApiException(messages);
        }
        _logger.LogInformation("[Profile] Password changed for user {UserId}.", user.Id);
    }

    public async Task DeleteAccountAsync(ClaimsPrincipal principal, DeleteAccountRequest request)
    {
        var user = await RequireUserAsync(principal);
        if (!await _userManager.CheckPasswordAsync(user, request.Password))
            throw new ValidationApiException("Password is incorrect.");

        var roles = await _userManager.GetRolesAsync(user);

        // A coach owning teams would orphan whole rosters — make them clean up explicitly first.
        if (roles.Contains("Coach") && await _context.Teams.AnyAsync(t => t.CoachId == user.Id))
            throw new ValidationApiException("Delete or transfer your teams before deleting your account.");

        // Unlink (not delete) the athlete's player record — assessments/history stay with the coach.
        var players = await _context.Players.Where(p => p.UserId == user.Id).ToListAsync();
        foreach (var p in players) p.UserId = null;

        var refreshTokens = await _context.RefreshTokens.Where(t => t.UserId == user.Id).ToListAsync();
        _context.RefreshTokens.RemoveRange(refreshTokens);
        var pushSubs = await _context.PushSubscriptions.Where(s => s.UserId == user.Id).ToListAsync();
        _context.PushSubscriptions.RemoveRange(pushSubs);
        await _context.SaveChangesAsync();

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
            throw new ValidationApiException(result.Errors.Select(e => e.Description));

        _logger.LogInformation("[Profile] Account deleted for user {UserId}.", user.Id);
    }

    private async Task<ApplicationUser> RequireUserAsync(ClaimsPrincipal principal)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) throw new UnauthorizedApiException();
        return await _userManager.FindByIdAsync(userId) ?? throw new UnauthorizedApiException();
    }

    private async Task<ProfileDto> ToDtoAsync(ApplicationUser user, IList<string> roles)
    {
        var dto = new ProfileDto
        {
            Id = user.Id,
            Email = user.Email ?? "",
            DisplayName = user.DisplayName,
            Roles = roles.ToList(),
            PhoneNumber = user.PhoneNumber,
            Bio = user.Bio,
            ProfilePictureUrl = user.ProfilePictureUrl,
            EmergencyContactName = user.EmergencyContactName,
            EmergencyContactPhone = user.EmergencyContactPhone,
            EmergencyContactRelationship = user.EmergencyContactRelationship,
            CoachingExperience = user.CoachingExperience,
            Certifications = user.Certifications,
            Specialization = user.Specialization,
            HasCompletedOnboarding = user.HasCompletedOnboarding,
        };

        if (roles.Contains("Athlete"))
        {
            var player = await _context.Players
                .Include(p => p.Team).Include(p => p.Position).Include(p => p.Sport)
                .FirstOrDefaultAsync(p => p.UserId == user.Id);
            if (player != null)
            {
                dto.PlayerId = player.Id;
                dto.DateOfBirth = player.DateOfBirth;
                dto.Height = player.Height;
                dto.Weight = player.Weight;
                dto.JerseyNumber = player.JerseyNumber;
                dto.TeamId = player.TeamId;
                dto.TeamName = player.Team?.Name;
                dto.PositionName = player.Position?.Name;
                dto.SportName = player.Sport?.Name;
                dto.FitnessLevel = player.FitnessLevel;
            }
        }

        return dto;
    }

    private static int ComputeAge(DateTime dateOfBirth)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
