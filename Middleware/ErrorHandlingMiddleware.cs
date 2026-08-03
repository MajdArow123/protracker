using System.Text.Json;
using ProTracker.Common;

namespace ProTracker.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            var (status, message, errors) = Map(ex);

            if (status == StatusCodes.Status500InternalServerError)
                _logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = status;

            var body = new ApiErrorResponse { Message = message, Errors = errors };
            await context.Response.WriteAsync(JsonSerializer.Serialize(body, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));
        }
    }

    private static (int Status, string Message, List<string> Errors) Map(Exception ex) => ex switch
    {
        NotFoundApiException nf => (StatusCodes.Status404NotFound, nf.Message, new List<string>()),
        ForbiddenApiException fb => (StatusCodes.Status403Forbidden, fb.Message, new List<string>()),
        UnauthorizedApiException ua => (StatusCodes.Status401Unauthorized, ua.Message, new List<string>()),
        PlanLimitApiException pl => (StatusCodes.Status402PaymentRequired, pl.Message, new List<string>()),
        ConflictApiException cf => (StatusCodes.Status409Conflict, cf.Message, new List<string>()),
        BadRequestApiException br => (StatusCodes.Status400BadRequest, br.Message, new List<string>()),
        ValidationApiException ve => (StatusCodes.Status400BadRequest, ve.Message, ve.Errors),
        _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", new List<string>())
    };
}
