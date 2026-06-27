namespace ProTracker.Dtos;

public class UserDto
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List<string> Roles { get; set; } = new();
}

public class UserUpdateDto
{
    public string DisplayName { get; set; } = "";
}
