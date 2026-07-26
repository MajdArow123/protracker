using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    // client's contract is exactly { mealName, detail, generatedAt }.
    // Validation failures -> 400 (FluentValidation auto-validation); AI errors/timeouts
    // surface as 500 via ErrorHandlingMiddleware; rate limit -> 429.
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("meal-suggestion")]
    public async Task<ActionResult<MealSuggestionResponse>> Suggest(MealSuggestionRequest request) =>
        Ok(await _service.SuggestAsync(request));
}
