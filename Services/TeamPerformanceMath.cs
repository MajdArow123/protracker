using ProTracker.Dtos;

namespace ProTracker.Services;

// Pure aggregation math for the team performance rollup (Phase G continuation,
// Section 6). Public statics so the claims made to coaches are unit-testable
// without a database — same pattern as EvidenceScoringEngine's normalization.
public static class TeamPerformanceMath
{
    // Spread from 2-3 data points is noise presented as insight.
    public const int MinScoredForStdDev = 4;
    // An "outlier" among fewer than 3 scored players is a fabricated claim.
    public const int MinScoredForOutliers = 3;
    // "Notably" low/high, quantified: at least this far from the team average.
    public const decimal OutlierDistance = 1.5m;
    public const int MaxOutliersPerSide = 2;

    // Score bands mirror the frontend's canonical scoreTone (chartColors.ts):
    // red < 5.0 ≤ amber < 7.0 ≤ green. Keep the two in sync.
    public static TeamBandCountsDto CountBands(IEnumerable<decimal> scores)
    {
        var counts = new TeamBandCountsDto();
        foreach (var s in scores)
        {
            if (s < 5m) counts.Red++;
            else if (s < 7m) counts.Amber++;
            else counts.Green++;
        }
        return counts;
    }

    // Sample (n-1) standard deviation — the scored players are a sample of the
    // squad, not the whole population. Null below MinScoredForStdDev.
    public static decimal? SampleStdDev(IReadOnlyCollection<decimal> scores)
    {
        if (scores.Count < MinScoredForStdDev) return null;
        var mean = scores.Average();
        var sumSq = scores.Sum(s => (double)((s - mean) * (s - mean)));
        return Math.Round((decimal)Math.Sqrt(sumSq / (scores.Count - 1)), 2);
    }

    // Notably-low / notably-high players relative to the team average. Empty on
    // thin coverage; at most MaxOutliersPerSide per side, worst/best first.
    public static (List<TeamMetricOutlierDto> Low, List<TeamMetricOutlierDto> High) PickOutliers(
        IReadOnlyList<TeamMetricOutlierDto> scored, decimal average)
    {
        if (scored.Count < MinScoredForOutliers)
            return (new List<TeamMetricOutlierDto>(), new List<TeamMetricOutlierDto>());

        var low = scored
            .Where(s => average - s.Score >= OutlierDistance)
            .OrderBy(s => s.Score)
            .Take(MaxOutliersPerSide)
            .ToList();
        var high = scored
            .Where(s => s.Score - average >= OutlierDistance)
            .OrderByDescending(s => s.Score)
            .Take(MaxOutliersPerSide)
            .ToList();
        return (low, high);
    }
}
