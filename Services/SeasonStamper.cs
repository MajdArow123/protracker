using ProTracker.Dtos;

namespace ProTracker.Services;

// What a create path attaches to a new record. SeasonId is set only on Resolved;
// Notice is set only on Ambiguous (so the UI can nudge the coach to fix overlapping
// season dates) — NoCoveringSeason is the silent, normal off-season case.
public readonly record struct SeasonStamp(int? SeasonId, SeasonResolutionNoticeDto? Notice);

// Phase 10 S3 ruling: a create NEVER fails because of season resolution. Resolution is
// metadata; the record is the user's actual data and must always be saved. This wrapper
// is the only sanctioned way for a create path to consult the resolver — it maps every
// outcome (including a thrown exception) to a stamp, never to an error.
public interface ISeasonStamper
{
    Task<SeasonStamp> ForTeamAsync(int teamId, DateOnly date);
    Task<SeasonStamp> ForPlayerAsync(int playerId, DateOnly date);
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

    private static SeasonStamp Map(SeasonResolution resolution) => resolution.Outcome switch
    {
        SeasonResolutionOutcome.Resolved => new SeasonStamp(resolution.SeasonId, null),
        SeasonResolutionOutcome.Ambiguous => new SeasonStamp(null, new SeasonResolutionNoticeDto
        {
            CandidateSeasonIds = resolution.CandidateSeasonIds.ToList(),
        }),
        _ => default,
    };
}
