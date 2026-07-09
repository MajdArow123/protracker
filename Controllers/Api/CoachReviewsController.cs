using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class CoachReviewsController : ApiControllerBase
{
    private readonly ICoachReviewService _service;

    public CoachReviewsController(ICoachReviewService service)
    {
        _service = service;
    }

    // Public reviews + summary. Reads the caller (if a token is present) to flag own review.
    [HttpGet("coaches/{slug}/reviews")]
    [AllowAnonymous]
    [EnableRateLimiting("join-validate")]
    public async Task<ActionResult> Get(string slug) => Success(await _service.GetForCoachAsync(User, slug));

    // Athlete / solo submits a review (one per coach).
    [HttpPost("coaches/{slug}/reviews")]
    [Authorize(Roles = "Athlete,SoloAthlete")]
    public async Task<ActionResult> Submit(string slug, SubmitCoachReviewDto dto)
        => Created(await _service.SubmitAsync(User, slug, dto));

    // Coach responds to a review on their own profile.
    [HttpPut("coach-reviews/{id}/response")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Respond(int id, RespondToReviewDto dto)
        => Success(await _service.RespondAsync(User, id, dto.Response));

    // Reviewer deletes their own review.
    [HttpDelete("coach-reviews/{id}")]
    [Authorize(Roles = "Athlete,SoloAthlete,Admin")]
    public async Task<ActionResult> Delete(int id)
    {
        await _service.DeleteAsync(User, id);
        return NoContentSuccess();
    }
}
