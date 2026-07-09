namespace ProTracker.Dtos;

public class CoachAnalyticsDto
{
    public bool IsPublic { get; set; }

    public int TotalViews { get; set; }
    public int ViewsThisWeek { get; set; }
    public int ViewsThisMonth { get; set; }

    public int TotalRequests { get; set; }
    public int PendingRequests { get; set; }
    public int AcceptedRequests { get; set; }
    public double AcceptanceRate { get; set; } // 0-100

    public int TotalReviews { get; set; }
    public double? AverageRating { get; set; }

    public int ProfileCompleteness { get; set; } // 0-100

    public Dictionary<string, int> ViewsBySource { get; set; } = new();

    // Daily view counts for the last 30 days (oldest first).
    public List<ViewPointDto> ViewsTrend { get; set; } = new();

    // The completeness checklist (label + weight + whether done).
    public List<CompletenessItemDto> CompletenessItems { get; set; } = new();
}

public class ViewPointDto
{
    public string Date { get; set; } = ""; // yyyy-MM-dd
    public int Count { get; set; }
}

public class CompletenessItemDto
{
    public string Label { get; set; } = "";
    public int Weight { get; set; }
    public bool Done { get; set; }
}
