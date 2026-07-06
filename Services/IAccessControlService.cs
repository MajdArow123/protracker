using System.Security.Claims;
using ProTracker.Models;

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

    // Players a Parent-role user is linked to (their children). Empty for other roles.
    Task<List<int>> GetParentPlayerIdsAsync(ClaimsPrincipal user);

    // Solo athletes manage their own player record completely (coach-like writes,
    // scoped to exactly one player). Role lives in the JWT, so this is claims-only.
    bool IsSoloAthlete(ClaimsPrincipal user);

    // The player record linked to this user's account (athlete or solo athlete).
    Task<Player> RequireOwnPlayerAsync(ClaimsPrincipal user);
}
