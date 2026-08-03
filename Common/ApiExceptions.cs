namespace ProTracker.Common;

// Thrown by services for control flow on known failure cases; ErrorHandlingMiddleware
// maps each of these to the appropriate HTTP status code and the standard error envelope.

public class NotFoundApiException : Exception
{
    public NotFoundApiException(string message) : base(message) { }
}

public class ForbiddenApiException : Exception
{
    public ForbiddenApiException(string message = "You do not have access to this resource.") : base(message) { }
}

public class UnauthorizedApiException : Exception
{
    public UnauthorizedApiException(string message = "Authentication is required.") : base(message) { }
}

// The action is blocked by the coach's current plan. Maps to 402 so the frontend can
// distinguish "upgrade needed" from a plain authorization failure.
public class PlanLimitApiException : Exception
{
    public PlanLimitApiException(string message) : base(message) { }
}

// The request conflicts with current server state (stale version, published lock).
// Maps to 409; the client refetches and derives the resolution path from data.
public class ConflictApiException : Exception
{
    public ConflictApiException(string message) : base(message) { }
}

// 400 with the message passed through verbatim (unlike ValidationApiException's generic
// message + errors list). Used for AI-output parse failures where the frontend surfaces
// the message directly and the user's remedy is to retry.
public class BadRequestApiException : Exception
{
    public BadRequestApiException(string message) : base(message) { }
}

public class ValidationApiException : Exception
{
    public List<string> Errors { get; }

    public ValidationApiException(IEnumerable<string> errors) : base("One or more validation errors occurred.")
    {
        Errors = errors.ToList();
    }

    public ValidationApiException(string error) : base("One or more validation errors occurred.")
    {
        Errors = new List<string> { error };
    }
}
