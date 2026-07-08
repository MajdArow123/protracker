namespace ProTracker.Dtos;

public class AssessmentTemplateScoreDto
{
    public int SportStatCategoryId { get; set; }
    public string CategoryName { get; set; } = "";
    public decimal? DefaultScore { get; set; }
    public decimal? Weight { get; set; }
    public bool IsRequired { get; set; }
}

public class AssessmentTemplateDto
{
    public int Id { get; set; }
    public string CoachId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SportId { get; set; }
    public string SportName { get; set; } = "";
    public string? DefaultNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<AssessmentTemplateScoreDto> Scores { get; set; } = new();
}

public class CreateAssessmentTemplateScoreDto
{
    public int SportStatCategoryId { get; set; }
    public decimal? DefaultScore { get; set; }
    public decimal? Weight { get; set; }
    public bool IsRequired { get; set; }
}

public class CreateAssessmentTemplateDto
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SportId { get; set; }
    public string? DefaultNotes { get; set; }
    public List<CreateAssessmentTemplateScoreDto> Scores { get; set; } = new();
}

// Result of applying a template to a player — the defaults to pre-fill the assessment form.
public class AppliedTemplateDto
{
    public int TemplateId { get; set; }
    public string TemplateName { get; set; } = "";
    public int PlayerId { get; set; }
    public string? DefaultNotes { get; set; }
    public List<AssessmentTemplateScoreDto> Scores { get; set; } = new();
}
