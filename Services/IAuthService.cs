using System.Security.Claims;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface IAuthService
{
    Task<(UserInfoDto User, string AccessToken, string RefreshToken)> RegisterAsync(RegisterRequest request);
    Task<RegisterAthleteResponse> RegisterAthleteAsync(RegisterAthleteRequest request);
    Task<RegisterSoloResponse> RegisterSoloAsync(RegisterSoloRequest request);
    Task<ConnectCoachResponse> ConnectCoachAsync(ClaimsPrincipal user, ConnectCoachRequest request);
    Task<(UserInfoDto User, string AccessToken, string RefreshToken)> LoginAsync(LoginRequest request);
    Task LogoutAsync(string? rawRefreshToken);
    Task<(string AccessToken, string RefreshToken)> RefreshAsync(string? rawRefreshToken);
    Task<UserInfoDto> GetCurrentUserAsync(ClaimsPrincipal user);
    Task ForgotPasswordAsync(string email);
    Task<ValidateResetTokenResponse> ValidateResetTokenAsync(string token);
    Task ResetPasswordAsync(string token, string newPassword);
}
