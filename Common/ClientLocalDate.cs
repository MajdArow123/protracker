using System.Globalization;

namespace ProTracker.Common;

// Phase 10 S2.2 ruling: "today" is the USER'S local calendar date, supplied by the
// client as yyyy-MM-dd; a server-derived UTC value is a FALLBACK only. Every S3+ call
// site that needs a "today" (or the local date of an instant) must parse it through
// here — no new call site may introduce DateTime.UtcNow.Date as the primary source.
public static class ClientLocalDate
{
    // Anchor = UTC today. For "the user's today" (e.g. /seasons/current, plan creates).
    public static DateOnly ResolveToday(string? date) =>
        Resolve(date, DateOnly.FromDateTime(DateTime.UtcNow), "the current UTC date");

    // Anchor = the UTC date of a client-supplied instant (e.g. a session's StartTime):
    // the client's local calendar date for an instant can differ from its UTC date by
    // at most one day, so the same ±1-day cap applies.
    public static DateOnly Resolve(string? date, DateOnly anchorUtc, string anchorDescription)
    {
        if (string.IsNullOrWhiteSpace(date)) return anchorUtc;

        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed))
            throw new BadRequestApiException("date must be an ISO date in yyyy-MM-dd format.");

        // No real timezone offset exceeds ±14h, so anything beyond ±1 day is a bad
        // caller or tampering — do NOT widen this window.
        if (Math.Abs(parsed.DayNumber - anchorUtc.DayNumber) > 1)
            throw new BadRequestApiException($"date must be within one day of {anchorDescription}.");

        return parsed;
    }
}
