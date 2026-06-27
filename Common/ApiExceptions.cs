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
