using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Public coach marketplace + the coach's own public-profile settings. Absolute "api"
// sub-routes so both /api/coaches (public) and /api/profile/coach-public (owner) live here.
[Route("api")]
public class CoachesController : ApiControllerBase
{
    private readonly ICoachPublicProfileService _service;

    public CoachesController(ICoachPublicProfileService service)
    {
        _service = service;
    }

    // Public marketplace listing (20/page). No auth. Rate-limited per IP.
    [HttpGet("coaches")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> List(
        [FromQuery] int? sport, [FromQuery] string? city, [FromQuery] string? country,
        [FromQuery] bool? accepting, [FromQuery] string? search,
        [FromQuery] int? minYears, [FromQuery] int? maxYears, [FromQuery] string? sort,
        [FromQuery] int page = 1)
        => Success(await _service.ListAsync(new CoachMarketplaceQuery
        {
            Sport = sport, City = city, Country = country, Accepting = accepting, Search = search,
            MinYears = minYears, MaxYears = maxYears, Sort = sort, Page = page,
        }));

    // Public coach profile by slug. No auth. 404 for missing OR non-public slugs.
    [HttpGet("coaches/{slug}")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> GetPublic(string slug) => Success(await _service.GetPublicAsync(slug));

    // The coach's own public-profile settings (lazily created with a stable slug).
    [HttpGet("profile/coach-public")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetSettings() => Success(await _service.GetSettingsAsync(User));

    [HttpPut("profile/coach-public")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> UpdateSettings(UpdateCoachPublicProfileDto dto)
        => Success(await _service.UpdateSettingsAsync(User, dto));
}
