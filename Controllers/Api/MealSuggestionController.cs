using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Public endpoint for the Vora iOS app (anonymous users — no ProTracker account).
// Rate-limited per IP because every call spends an Anthropic request.
//
// Phase 11 B0 containment (Q0 ruling): the caller must present the static app token
// in X-App-Token (fail CLOSED — unconfigured token means 503 for everyone), and a
// global daily cap hard-stops the endpoint's total Anthropic spend. Error bodies stay
// bare ApiErrorResponse per the Vora contract (never the {success, data} envelope).
[Route("api/v1/meal-suggestion")]
public class MealSuggestionController : ApiControllerBase
{
    public const string TokenHeader = "X-App-Token";

    private readonly IMealSuggestionService _service;
    private readonly MealSuggestionOptions _options;
    private readonly MealSuggestionDailyCounter _counter;
    private readonly ILogger<MealSuggestionController> _logger;

    public MealSuggestionController(
        IMealSuggestionService service,
        MealSuggestionOptions options,
        MealSuggestionDailyCounter counter,
        ILogger<MealSuggestionController> logger)
    {
        _service = service;
        _options = options;
        _counter = counter;
        _logger = logger;
    }

    // Returns the DTO bare (deliberately NOT the {success, data} envelope) — the Vora
    // client's contract is exactly the MealSuggestionResponse shape.
    // Validation failures -> 400 (FluentValidation auto-validation); rate limit -> 429;
    // missing/wrong token -> 401; token unconfigured or daily cap exhausted -> 503.
    // AI failures are caught here (not left to ErrorHandlingMiddleware, which would
    // genericize the message) so the client gets the contract's exact 500 message.
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("meal-suggestion")]
    public async Task<ActionResult<MealSuggestionResponse>> Suggest(MealSuggestionRequest request)
    {
        if (string.IsNullOrWhiteSpace(_options.AppToken))
        {
            _logger.LogError("[MealSuggestion] rejected call: no app token configured (fail closed).");
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiErrorResponse { Message = "Meal suggestions are temporarily unavailable." });
        }

        if (!TokenMatches(Request.Headers[TokenHeader].FirstOrDefault()))
        {
            _logger.LogWarning("[MealSuggestion] rejected call: missing or invalid app token.");
            return Unauthorized(new ApiErrorResponse { Message = "A valid app token is required." });
        }

        if (!_counter.TryTake(_options.DailyCap, out var countToday))
        {
            _logger.LogWarning("[MealSuggestion] daily cap {Cap} exhausted — rejecting call.",
                _options.DailyCap);
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiErrorResponse { Message = "Daily capacity reached. Try again tomorrow." });
        }

        _logger.LogInformation("[MealSuggestion] call {Count}/{Cap} today.", countToday, _options.DailyCap);

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

    private bool TokenMatches(string? provided)
    {
        if (string.IsNullOrEmpty(provided))
            return false;
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided),
            Encoding.UTF8.GetBytes(_options.AppToken!));
    }
}
