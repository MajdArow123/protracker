namespace ProTracker.Services;

// Phase 11 B0 (Q0 ruling): containment for the public Vora meal-suggestion endpoint —
// a static app token (fail CLOSED when unconfigured) plus a global daily stop-loss cap.
// This is containment, not metering design; per-account accounting lands with Q6/B5.

// AppToken comes from the MealSuggestion:AppToken config key (Railway env var
// MealSuggestion__AppToken). Empty/missing token disables the endpoint (503) — the
// loud failure mode, per the prod-secrets convention. DailyCap defaults to 200.
public sealed record MealSuggestionOptions(string? AppToken, int DailyCap);

// Process-wide daily call counter (UTC day). In-memory by design: the cap is a
// stop-loss against runaway Anthropic spend, not an accounting record — a reset on
// redeploy only ever errs toward allowing a few more calls, and the real usage
// ledger is Q6's AiUsage table.
public class MealSuggestionDailyCounter
{
    private readonly object _lock = new();
    private DateOnly _day;
    private int _count;

    // Takes one call from today's budget; false = cap exhausted (nothing taken).
    public bool TryTake(int cap, out int countToday)
    {
        lock (_lock)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (today != _day)
            {
                _day = today;
                _count = 0;
            }

            if (_count >= cap)
            {
                countToday = _count;
                return false;
            }

            countToday = ++_count;
            return true;
        }
    }
}
