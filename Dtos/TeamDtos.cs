namespace ProTracker.Dtos;

public class TeamDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SportId { get; set; }
    public string SportName { get; set; } = "";
    public string CoachId { get; set; } = "";
    public int PlayerCount { get; set; }
}

public class TeamWithPlayersDto : TeamDto
{
    public List<PlayerDto> Players { get; set; } = new();
}

public class TeamCreateDto
{
    public string Name { get; set; } = "";
    public int SportId { get; set; }
}

public class TeamUpdateDto
{
    public string Name { get; set; } = "";
}
