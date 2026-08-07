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

    // Phase 10 S4 ?seasonId= contract: a season that doesn't exist OR that the caller
    // can't read both throw NotFound (404, same message — no existence enumeration).
    // Never 403 and never an empty result: an empty list would be indistinguishable
    // from "no data in this season" and would hide authorization failures.
    Task EnsureCanAccessSeasonAsync(ClaimsPrincipal user, int seasonId);

    // Players a Parent-role user is linked to (their children). Empty for other roles.
    Task<List<int>> GetParentPlayerIdsAsync(ClaimsPrincipal user);

    // Solo athletes manage their own player record completely (coach-like writes,
    // scoped to exactly one player). Role lives in the JWT, so this is claims-only.
    bool IsSoloAthlete(ClaimsPrincipal user);

    // The player record linked to this user's account (athlete or solo athlete).
    Task<Player> RequireOwnPlayerAsync(ClaimsPrincipal user);

    // A coach's effective permissions on a team (head coach / admin = all; assistant = their
    // stored permissions). Throws Forbidden if the caller is not a coach on the team.
    Task<(CoachPermissions Permissions, bool IsHeadCoach)> GetTeamPermissionsAsync(ClaimsPrincipal user, int teamId);

    // Throws Forbidden if the caller (when an assistant coach) lacks the selected permission on
    // the team. Head coaches and admins always pass.
    Task EnsureTeamPermissionAsync(ClaimsPrincipal user, int teamId, Func<CoachPermissions, bool> selector, string message);

    // Access check for a player PLUS an assistant-coach permission gate. Athletes/solo athletes
    // (own player) and head coaches/admins pass once access is confirmed; only assistant coaches
    // are additionally gated by the selected permission on the player's team.
    Task EnsurePlayerPermissionAsync(ClaimsPrincipal user, int playerId, Func<CoachPermissions, bool> selector, string message);

    // Whether the caller may view coach-private notes on a player (head coach/admin/assistant
    // with the permission = true; assistant without it = false). Assumes access already checked.
    Task<bool> CanViewPrivateNotesAsync(ClaimsPrincipal user, int playerId);
}
