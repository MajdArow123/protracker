namespace ProTracker.Dtos;

public class RegisterRequest
{
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "Athlete"; // "Coach" or "Athlete"
}

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
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
}

public class RefreshRequest
{
    public string? RefreshToken { get; set; }
}

public class TokenResponse
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
}
