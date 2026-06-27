namespace ProTracker.Common;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
}

public class ApiErrorResponse
{
    public bool Success { get; set; } = false;
    public string Message { get; set; } = "";
    public List<string> Errors { get; set; } = new();
}
