using System.ComponentModel.DataAnnotations;

namespace ProTracker.Models;

public class Position
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";

    public int SportId { get; set; }
    public Sport Sport { get; set; } = null!;
}
