using System.Security.Claims;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IAuthService
{
    Task<(UserInfoDto User, string AccessToken, string RefreshToken)> LoginAsync(LoginRequest request);
    Task LogoutAsync(string? rawRefreshToken);
    Task<(string AccessToken, string RefreshToken)> RefreshAsync(string? rawRefreshToken);
    Task<UserInfoDto> GetCurrentUserAsync(ClaimsPrincipal user);
}
