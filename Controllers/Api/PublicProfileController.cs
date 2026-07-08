using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Athlete progress sharing. The owning athlete manages their sharing settings under
// /api/profile/public; the public, unauthenticated view lives at /api/public/{slug}.
[Route("api")]
public class PublicProfileController : ApiControllerBase
{
    private readonly IPublicProfileService _service;

    public PublicProfileController(IPublicProfileService service)
    {
        _service = service;
    }

    // Athlete/solo: my sharing settings (created lazily with a stable slug on first read).
    [HttpGet("profile/public")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> GetSettings() => Success(await _service.GetSettingsAsync(User));

    [HttpPut("profile/public")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> UpdateSettings(UpdatePublicProfileDto dto)
        => Success(await _service.UpdateSettingsAsync(User, dto));

    // Public, no auth: the shareable profile page. Rate-limited per IP (shared with the
    // other anonymous endpoints). Returns 404 for missing OR non-public slugs.
    [HttpGet("public/{slug}")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> GetPublic(string slug) => Success(await _service.GetPublicAsync(slug));
}
