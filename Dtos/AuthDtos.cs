namespace ProTracker.Dtos;

public class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public class UserInfoDto
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List<string> Roles { get; set; } = new();
}

public class LoginResponse
{
    public UserInfoDto User { get; set; } = null!;
}
