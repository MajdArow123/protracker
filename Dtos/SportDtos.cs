namespace ProTracker.Dtos;

public class SportDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? IconOrImage { get; set; }
}

public class SportWithDetailsDto : SportDto
{
    public List<PositionDto> Positions { get; set; } = new();
    public List<StatCategoryDto> StatCategories { get; set; } = new();
}

public class PositionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SportId { get; set; }
}

public class StatCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SportId { get; set; }
    public string? Description { get; set; }
}
