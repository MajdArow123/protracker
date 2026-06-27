using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class Sport
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";

    public string? Description { get; set; }

    public string? IconOrImage { get; set; }

    public List<Position> Positions { get; set; } = new();
    public List<SportStatCategory> StatCategories { get; set; } = new();
    public List<Team> Teams { get; set; } = new();
}
