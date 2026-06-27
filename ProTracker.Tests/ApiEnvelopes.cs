namespace ProTracker.Tests;

// Mirrors ProTracker.Common.ApiResponse<T>/ApiErrorResponse shapes for test deserialization.
public class TestApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
}

public class TestApiError
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public List<string> Errors { get; set; } = new();
}
