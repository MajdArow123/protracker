using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProTracker.Models;

public class PlayerStatScore
{
    public int Id { get; set; }

    public int PlayerAssessmentId { get; set; }
    public PlayerAssessment PlayerAssessment { get; set; } = null!;

    public int SportStatCategoryId { get; set; }
    public SportStatCategory SportStatCategory { get; set; } = null!;

    // 1-10 scale in 0.5 steps, consistent across the whole app.
    [Range(1, 10)]
    [Column(TypeName = "decimal(3,1)")]
    public decimal Score { get; set; }
}
