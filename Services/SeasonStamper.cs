using ProTracker.Dtos;

namespace ProTracker.Services;

// What a create path attaches to a new record. SeasonId is set only on Resolved;
// Notice is set only on Ambiguous (so the UI can nudge the coach to fix overlapping
// season dates) — NoCoveringSeason is the silent, normal off-season case.
public readonly record struct SeasonStamp(int? SeasonId, SeasonResolutionNoticeDto? Notice);

// What a date-changing update applies. SeasonId is the value to ASSIGN — on a resolver
// failure it echoes the record's current value (on update, unchanged is the safer
// failure mode, unlike create's null). Notice: Ambiguous keeps the create-path nudge;
// "SeasonUnstamped" fires only on a non-null -> null transition, never on null -> null.
public readonly record struct SeasonRestamp(int? SeasonId, SeasonResolutionNoticeDto? Notice);

// Phase 10 S3 ruling: a create (and, since the S3+ update step, an update) NEVER fails
// because of season resolution. Resolution is metadata; the record is the user's actual
// data and must always be saved. This wrapper is the only sanctioned way for a create or
// update path to consult the resolver — it maps every outcome (including a thrown
// exception) to a stamp, never to an error. Restamp* are for updates whose driving date
// changed; an update that doesn't touch the driving date must not call the stamper at all.
public interface ISeasonStamper
{
    Task<SeasonStamp> ForTeamAsync(int teamId, DateOnly date);
    Task<SeasonStamp> ForPlayerAsync(int playerId, DateOnly date);
    Task<SeasonRestamp> RestampForTeamAsync(int teamId, DateOnly date, int? currentSeasonId);
    Task<SeasonRestamp> RestampForPlayerAsync(int playerId, DateOnly date, int? currentSeasonId);
}

public class SeasonStamper : ISeasonStamper
{
    private readonly ISeasonResolver _resolver;
    private readonly ILogger<SeasonStamper> _logger;

    public SeasonStamper(ISeasonResolver resolver, ILogger<SeasonStamper> logger)
    {
        _resolver = resolver;
        _logger = logger;
    }

    public async Task<SeasonStamp> ForTeamAsync(int teamId, DateOnly date)
    {
        try
        {
            return Map(await _resolver.ResolveForTeamAsync(teamId, date));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Season stamping failed for team {TeamId} on {Date} — the record is saved without a season.",
                teamId, date);
            return default;
        }
    }

    public async Task<SeasonStamp> ForPlayerAsync(int playerId, DateOnly date)
    {
        try
        {
            return Map(await _resolver.ResolveForPlayerAsync(playerId, date));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Season stamping failed for player {PlayerId} on {Date} — the record is saved without a season.",
                playerId, date);
            return default;
        }
    }

    public async Task<SeasonRestamp> RestampForTeamAsync(int teamId, DateOnly date, int? currentSeasonId)
    {
        try
        {
            return MapRestamp(await _resolver.ResolveForTeamAsync(teamId, date), currentSeasonId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Season re-stamping failed for team {TeamId} on {Date} — the record keeps its current season.",
                teamId, date);
            return new SeasonRestamp(currentSeasonId, null);
        }
    }

    public async Task<SeasonRestamp> RestampForPlayerAsync(int playerId, DateOnly date, int? currentSeasonId)
    {
        try
        {
            return MapRestamp(await _resolver.ResolveForPlayerAsync(playerId, date), currentSeasonId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Season re-stamping failed for player {PlayerId} on {Date} — the record keeps its current season.",
                playerId, date);
            return new SeasonRestamp(currentSeasonId, null);
        }
    }

    private static SeasonStamp Map(SeasonResolution resolution) => resolution.Outcome switch
    {
        SeasonResolutionOutcome.Resolved => new SeasonStamp(resolution.SeasonId, null),
        SeasonResolutionOutcome.Ambiguous => new SeasonStamp(null, new SeasonResolutionNoticeDto
        {
            CandidateSeasonIds = resolution.CandidateSeasonIds.ToList(),
        }),
        _ => default,
    };

    private static SeasonRestamp MapRestamp(SeasonResolution resolution, int? currentSeasonId) => resolution.Outcome switch
    {
        SeasonResolutionOutcome.Resolved => new SeasonRestamp(resolution.SeasonId, null),
        SeasonResolutionOutcome.Ambiguous => new SeasonRestamp(null, new SeasonResolutionNoticeDto
        {
            CandidateSeasonIds = resolution.CandidateSeasonIds.ToList(),
        }),
        // NoCoveringSeason: unstamping an actual stamp deserves a nudge; null -> null is silent.
        _ => new SeasonRestamp(null, currentSeasonId == null ? null : new SeasonResolutionNoticeDto
        {
            Code = "SeasonUnstamped",
        }),
    };
}
