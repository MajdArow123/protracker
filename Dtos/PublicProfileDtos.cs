namespace ProTracker.Dtos;

// The athlete's own sharing settings (GET/PUT /api/profile/public).
public class PublicProfileSettingsDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Bio { get; set; }
    public bool IsPublic { get; set; }
    public bool ShowAssessments { get; set; }
    public bool ShowGoals { get; set; }
    public bool ShowJournal { get; set; }
    public bool ShowMatchHistory { get; set; }
}

public class UpdatePublicProfileDto
{
    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public bool IsPublic { get; set; }
    public bool ShowAssessments { get; set; }
    public bool ShowGoals { get; set; }
    public bool ShowJournal { get; set; }
    public bool ShowMatchHistory { get; set; }
}

// ─── Public (anonymous) view assembled at /api/public/{slug} ──────────────────

public class PublicRadarPointDto
{
    public string Category { get; set; } = "";
    public double Value { get; set; }
}

public class PublicGoalDto
{
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Status { get; set; } = "";
    public double? ProgressPercent { get; set; }
    public decimal? TargetValue { get; set; }
    public decimal? CurrentValue { get; set; }
    public string? Unit { get; set; }
}

public class PublicJournalDto
{
    public DateTime EntryDate { get; set; }
    public string Mood { get; set; } = "";
    public string Title { get; set; } = "";
    public string Excerpt { get; set; } = "";
}

public class PublicMatchDto
{
    public DateTime MatchDate { get; set; }
    public string OpponentName { get; set; } = "";
    public string Result { get; set; } = ""; // Win / Draw / Loss
    public int OurScore { get; set; }
    public int OpponentScore { get; set; }
    public decimal? Rating { get; set; }
}

public class PublicProfileDto
{
    public string Slug { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Sport { get; set; } = "";
    public string Position { get; set; } = "";
    public string? ProfileImageUrl { get; set; }
    public string? Bio { get; set; }

    public int AssessmentCount { get; set; }
    public double? LatestAvgScore { get; set; }

    public bool ShowAssessments { get; set; }
    public bool ShowGoals { get; set; }
    public bool ShowJournal { get; set; }
    public bool ShowMatchHistory { get; set; }

    public List<PublicRadarPointDto> Skills { get; set; } = new();
    public List<PublicGoalDto> Goals { get; set; } = new();
    public List<PublicJournalDto> Journal { get; set; } = new();
    public List<PublicMatchDto> Matches { get; set; } = new();
}
