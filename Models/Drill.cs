using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public enum DrillCategory
{
    WarmUp,
    Technical,
    Tactical,
    Fitness,
    Strength,
    Speed,
    Agility,
    Recovery,
    Mental,
    Cooldown
}

public enum DrillDifficulty
{
    Beginner,
    Intermediate,
    Advanced,
    Elite
}

// A drill/exercise in the library. Built-in drills (IsBuiltIn, CoachId null) are seeded and
// visible to everyone; custom drills are created by a coach/solo athlete and visible only to
// their creator. A drill can apply to multiple sports (SportIds is a comma-separated list of
// Sport ids) so it only surfaces for the relevant sport(s).
public class Drill
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";

    public string? Description { get; set; }

    // Comma-separated Sport ids this drill applies to, e.g. "1" or "1,2".
    public string SportIds { get; set; } = "";

    public DrillCategory Category { get; set; } = DrillCategory.Technical;
    public DrillDifficulty Difficulty { get; set; } = DrillDifficulty.Beginner;

    public int? DurationMinutes { get; set; }
    public string? Equipment { get; set; }

    // Step-by-step instructions (newline-separated steps).
    public string? Instructions { get; set; }

    public string? VideoUrl { get; set; }

    // Comma-separated stat category names this drill improves (e.g. "Passing,Ball Control").
    public string? TargetStatCategories { get; set; }

    public bool IsBuiltIn { get; set; }

    // ApplicationUser Id of the coach/solo athlete who created a custom drill (null for built-in).
    public string? CoachId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// A user's favorited drill (many-to-many between users and drills).
public class DrillFavorite
{
    public int Id { get; set; }

    public int DrillId { get; set; }
    public Drill Drill { get; set; } = null!;

    public string UserId { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
