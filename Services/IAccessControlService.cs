using System.Security.Claims;

namespace ProTracker.Services;

// Central enforcement point for "coaches can only access their own teams/players" and
// "players can only access their own data". Every other service calls through here rather
// than re-implementing ownership checks, so the rule lives in exactly one place.
public interface IAccessControlService
{
    string RequireUserId(ClaimsPrincipal user);

    Task EnsureCanAccessTeamAsync(ClaimsPrincipal user, int teamId);

    // throwOnAthleteMismatch: when true, an Athlete who isn't this player throws Forbidden.
    Task EnsureCanAccessPlayerAsync(ClaimsPrincipal user, int playerId);

    Task<List<int>> GetAccessibleTeamIdsAsync(ClaimsPrincipal user);
}
