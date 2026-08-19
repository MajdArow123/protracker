using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// Phase 10 §5d Q3 (forward path): a join is a recorded fact, so the system opens the
// stint itself. Contract (all binding, pinned in CLAUDE.md):
// - BEST-EFFORT AND ISOLATED: this method NEVER throws and runs on its own DI scope
//   (own DbContext), so it can neither fail, block, nor roll back the join that
//   triggered it (NotificationService.CreateAsync precedent). Callers invoke it AFTER
//   their primary commit.
// - The join date is the client's LOCAL calendar date per the S2.2 ruling (UTC-today
//   fallback). A malformed date is treated as absent here rather than thrown — a
//   tampered metadata field must not turn a committed join into an error response.
// - Resolution via SeasonResolver (post-clamp): exactly one season -> open stint
//   (start = join date, end = null, Source = SystemOnJoin). Gap -> silent no-op (an
//   off-season signing is routine). Ambiguous -> no stint + the existing notice
//   mechanism (returned for coach-facing responses to attach; athlete-actor paths
//   have no coach in the loop and rely on the resolver's warning log).
// - If the S6 one-covering-stint rule would reject the stint -> silent no-op; an
//   overlap 400 must never surface through a join.
public interface IRosterStintRecorder
{
    Task<SeasonResolutionNoticeDto?> RecordJoinAsync(int playerId, int teamId, string? clientLocalDate);
}

public class RosterStintRecorder : IRosterStintRecorder
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RosterStintRecorder> _logger;

    public RosterStintRecorder(IServiceScopeFactory scopeFactory, ILogger<RosterStintRecorder> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<SeasonResolutionNoticeDto?> RecordJoinAsync(int playerId, int teamId, string? clientLocalDate)
    {
        try
        {
            DateOnly joinDate;
            try
            {
                joinDate = ClientLocalDate.ResolveToday(clientLocalDate);
            }
            catch (BadRequestApiException)
            {
                _logger.LogWarning(
                    "RecordJoinAsync got an invalid localDate '{LocalDate}' for player {PlayerId} — falling back to UTC today",
                    clientLocalDate, playerId);
                joinDate = DateOnly.FromDateTime(DateTime.UtcNow);
            }

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var resolver = scope.ServiceProvider.GetRequiredService<ISeasonResolver>();

            var resolution = await resolver.ResolveForTeamAsync(teamId, joinDate);
            if (resolution.Outcome == SeasonResolutionOutcome.Ambiguous)
                return new SeasonResolutionNoticeDto
                {
                    Code = "AmbiguousSeason",
                    CandidateSeasonIds = resolution.CandidateSeasonIds.ToList(),
                };
            if (resolution.Outcome != SeasonResolutionOutcome.Resolved) return null;

            var seasonId = resolution.SeasonId!.Value;
            var dayStart = joinDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            // S6 one-covering-stint rule: the new stint is open-ended [joinDate, ∞),
            // which intersects any stint in this season that hasn't ended before the
            // join day. Overlap -> silent no-op, never a 400 through a join.
            var overlaps = await context.SeasonRosters.AnyAsync(r =>
                r.PlayerId == playerId && r.SeasonId == seasonId
                && (r.LeftAt == null || r.LeftAt >= dayStart));
            if (overlaps) return null;

            var player = await context.Players.FirstOrDefaultAsync(p => p.Id == playerId);
            if (player == null) return null;

            context.SeasonRosters.Add(new SeasonRoster
            {
                PlayerId = playerId,
                SeasonId = seasonId,
                TeamId = teamId,
                JoinedAt = dayStart,
                LeftAt = null,
                // Facts of the player record at join time, same fields S6 collects.
                JerseyNumber = player.JerseyNumber,
                PositionId = player.PositionId,
                Source = StintSource.SystemOnJoin,
            });
            await context.SaveChangesAsync();
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Auto-stint on join failed for player {PlayerId} / team {TeamId} — join unaffected",
                playerId, teamId);
            return null;
        }
    }
}
