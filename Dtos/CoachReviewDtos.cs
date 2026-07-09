namespace ProTracker.Dtos;

public class SubmitCoachReviewDto
{
    public int Rating { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public int? Sport { get; set; }
}

public class RespondToReviewDto
{
    public string? Response { get; set; }
}

public class CoachReviewDto
{
    public int Id { get; set; }
    public string ReviewerName { get; set; } = "";
    public int Rating { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public int? SportId { get; set; }
    public string? SportName { get; set; }
    public bool IsVerified { get; set; }
    public string? CoachResponse { get; set; }
    public DateTime CreatedAt { get; set; }
    // True when the review belongs to the (authenticated) caller — enables the delete action.
    public bool IsMine { get; set; }
}

public class CoachReviewsResponseDto
{
    public double? AverageRating { get; set; }
    public int ReviewCount { get; set; }
    // Star -> count (keys "1".."5").
    public Dictionary<int, int> Distribution { get; set; } = new();
    public List<CoachReviewDto> Reviews { get; set; } = new();
    // True when the caller has already reviewed this coach (hide the write button).
    public bool HasReviewed { get; set; }
    // True when the caller is the owning coach (enables responding).
    public bool IsOwner { get; set; }
}
