using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class PlayerStatScore
{
    public int Id { get; set; }

    public int PlayerAssessmentId { get; set; }
    public PlayerAssessment PlayerAssessment { get; set; } = null!;

    public int SportStatCategoryId { get; set; }
    public SportStatCategory SportStatCategory { get; set; } = null!;

    // 1-10 scale, consistent across the whole app.
    [Range(1, 10)]
    public int Score { get; set; }
}
