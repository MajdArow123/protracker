using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Public endpoint for the Vora iOS app (anonymous users — no ProTracker account).
// Rate-limited per IP because every call spends an Anthropic request.
[Route("api/v1/meal-suggestion")]
public class MealSuggestionController : ApiControllerBase
{
    private readonly IMealSuggestionService _service;

    public MealSuggestionController(IMealSuggestionService service)
    {
        _service = service;
    }

    // Returns the DTO bare (deliberately NOT the {success, data} envelope) — the Vora
    // client's contract is exactly the MealSuggestionResponse shape.
    // Validation failures -> 400 (FluentValidation auto-validation); rate limit -> 429.
    // AI failures are caught here (not left to ErrorHandlingMiddleware, which would
    // genericize the message) so the client gets the contract's exact 500 message.
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("meal-suggestion")]
    public async Task<ActionResult<MealSuggestionResponse>> Suggest(MealSuggestionRequest request)
    {
        try
        {
            return Ok(await _service.SuggestAsync(request));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiErrorResponse { Message = ex.Message });
        }
    }
}
