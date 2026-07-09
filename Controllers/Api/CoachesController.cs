using System.Security.Claims;
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
    private readonly ICoachAnalyticsService _analytics;

    public CoachesController(ICoachPublicProfileService service, ICoachAnalyticsService analytics)
    {
        _service = service;
        _analytics = analytics;
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
    // Records a (deduped) profile view for analytics — best-effort, never blocks the response.
    [HttpGet("coaches/{slug}")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> GetPublic(string slug, [FromQuery] string? source)
    {
        var dto = await _service.GetPublicAsync(slug);
        var viewerId = User.Identity?.IsAuthenticated == true ? User.FindFirstValue(ClaimTypes.NameIdentifier) : null;
        await _analytics.RecordViewAsync(slug, source, ClientIp(), viewerId);
        return Success(dto);
    }

    // Coach's marketplace analytics (views, requests funnel, reviews, completeness).
    [HttpGet("coach/profile-analytics")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Analytics() => Success(await _analytics.GetAnalyticsAsync(User));

    // Best-effort client IP (honours the proxy's X-Forwarded-For on Railway).
    private string? ClientIp()
    {
        var fwd = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(fwd)) return fwd.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    // The coach's own public-profile settings (lazily created with a stable slug).
    [HttpGet("profile/coach-public")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetSettings() => Success(await _service.GetSettingsAsync(User));

    [HttpPut("profile/coach-public")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> UpdateSettings(UpdateCoachPublicProfileDto dto)
        => Success(await _service.UpdateSettingsAsync(User, dto));
}
