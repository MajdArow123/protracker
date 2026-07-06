using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Models;

namespace ProTracker.Services;

public class AccessControlService : IAccessControlService
{
    private readonly ApplicationDbContext _context;

    public AccessControlService(ApplicationDbContext context)
    {
        _context = context;
    }

    public string RequireUserId(ClaimsPrincipal user)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedApiException();
        return userId;
    }

    public bool IsSoloAthlete(ClaimsPrincipal user) => user.IsInRole("SoloAthlete");

    // Any athlete-like role owns exactly one player record (their own).
    private static bool IsSelfOwnedAthlete(ClaimsPrincipal user) =>
        user.IsInRole("Athlete") || user.IsInRole("SoloAthlete");

    public async Task<Player> RequireOwnPlayerAsync(ClaimsPrincipal user)
    {
        var userId = RequireUserId(user);
        return await _context.Players.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new NotFoundApiException("No player record is linked to your account.");
    }

    public async Task EnsureCanAccessTeamAsync(ClaimsPrincipal user, int teamId)
    {
        if (user.IsInRole("Admin"))
            return;

        var teamExists = await _context.Teams.AnyAsync(t => t.Id == teamId);
        if (!teamExists)
            throw new NotFoundApiException($"Team {teamId} was not found.");

        if (user.IsInRole("Coach"))
        {
            var userId = RequireUserId(user);
            var hasScope = await _context.CoachTeamScopes.AnyAsync(s => s.TeamId == teamId && s.CoachId == userId);
            if (!hasScope)
                throw new ForbiddenApiException("You do not have access to this team.");
            return;
        }

        if (IsSelfOwnedAthlete(user))
        {
            var userId = RequireUserId(user);
            var isOnTeam = await _context.Players.AnyAsync(p => p.TeamId == teamId && p.UserId == userId);
            if (!isOnTeam)
                throw new ForbiddenApiException("You do not have access to this team.");
            return;
        }

        throw new ForbiddenApiException();
    }

    public async Task EnsureCanAccessPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        if (user.IsInRole("Admin"))
            return;

        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId);
        if (player == null)
            throw new NotFoundApiException($"Player {playerId} was not found.");

        if (user.IsInRole("Coach"))
        {
            var userId = RequireUserId(user);
            // Solo players (TeamId null) never match a coach scope, so coaches can't see them.
            var hasScope = player.TeamId != null
                && await _context.CoachTeamScopes.AnyAsync(s => s.TeamId == player.TeamId && s.CoachId == userId);
            if (!hasScope)
                throw new ForbiddenApiException("You do not have access to this player.");
            return;
        }

        // Athletes and solo athletes may only ever touch their own player record.
        if (IsSelfOwnedAthlete(user))
        {
            var userId = RequireUserId(user);
            if (player.UserId != userId)
                throw new ForbiddenApiException("You can only access your own player profile.");
            return;
        }

        // NB: Parent is deliberately NOT handled here. Parents are read-only and must go through
        // the dedicated /api/parent/* endpoints (which do their own link check) — this keeps them
        // out of every coach/athlete endpoint that funnels through EnsureCanAccessPlayer, so they
        // can never reach coach-private notes or other players.
        throw new ForbiddenApiException();
    }

    public async Task<List<int>> GetParentPlayerIdsAsync(ClaimsPrincipal user)
    {
        if (!user.IsInRole("Parent")) return new();
        var userId = RequireUserId(user);
        return await _context.ParentLinks.Where(l => l.ParentUserId == userId).Select(l => l.PlayerId).ToListAsync();
    }

    public async Task<List<int>> GetAccessibleTeamIdsAsync(ClaimsPrincipal user)
    {
        if (user.IsInRole("Admin"))
            return await _context.Teams.Select(t => t.Id).ToListAsync();

        var userId = RequireUserId(user);

        if (user.IsInRole("Coach"))
            return await _context.CoachTeamScopes.Where(s => s.CoachId == userId).Select(s => s.TeamId).ToListAsync();

        if (IsSelfOwnedAthlete(user))
            return await _context.Players
                .Where(p => p.UserId == userId && p.TeamId != null)
                .Select(p => p.TeamId!.Value)
                .Distinct()
                .ToListAsync();

        return new List<int>();
    }
}
