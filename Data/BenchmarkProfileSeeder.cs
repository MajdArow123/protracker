using Microsoft.EntityFrameworkCore;
using ProTracker.Models;

namespace ProTracker.Data;

// Seeds the five system benchmark profiles per sport (Youth U12-U14, Junior U15-U18,
// Amateur Adult, Semi-Professional, Professional). Amateur Adult mirrors the
// SportMetricDefinition defaults exactly; the other levels are derived with per-level
// multipliers that respect each metric's type and direction (sprint seconds shrink as
// level rises, distances/counts grow, percentages grow gently and cap at 99).
// The soccer 30m sprint gets the spec's exact hand-tuned values.
// Idempotent: inserts only when no default profiles exist. Runs after
// MetricDefinitionSeeder (needs the metric rows).
public static class BenchmarkProfileSeeder
{
    private sealed record Level(string Name, int? AgeMin, int? AgeMax, CompetitionLevel Comp,
        decimal TimerFactor, decimal QuantityFactor, decimal PercentFactor);

    private static readonly Level[] Levels =
    {
        new("Youth (U12–U14)", 12, 14, CompetitionLevel.Amateur, 1.15m, 0.75m, 0.85m),
        new("Junior (U15–U18)", 15, 18, CompetitionLevel.Amateur, 1.07m, 0.88m, 0.93m),
        new("Amateur Adult", 18, null, CompetitionLevel.Amateur, 1.00m, 1.00m, 1.00m),
        new("Semi-Professional", null, null, CompetitionLevel.SemiPro, 0.95m, 1.10m, 1.05m),
        new("Professional", null, null, CompetitionLevel.Professional, 0.91m, 1.20m, 1.10m),
    };

    // Spec-exact soccer 30m sprint anchors per level (Low/Mid/High, seconds).
    private static readonly Dictionary<string, (decimal, decimal, decimal)> SoccerSpeedOverrides = new()
    {
        ["Youth (U12–U14)"] = (5.2m, 4.8m, 4.3m),
        ["Junior (U15–U18)"] = (4.8m, 4.4m, 4.0m),
        ["Amateur Adult"] = (4.8m, 4.3m, 3.8m), // = metric definition defaults
        ["Semi-Professional"] = (4.3m, 4.0m, 3.7m),
        ["Professional"] = (4.1m, 3.9m, 3.6m),
    };

    public static async Task SeedAsync(ApplicationDbContext context)
    {
        if (await context.BenchmarkProfiles.AnyAsync(p => p.IsDefault))
            return;

        var metrics = await context.SportMetricDefinitions
            .Where(m => m.InputType != MetricInputType.Rating)
            .ToListAsync();
        if (metrics.Count == 0) return; // metric seeder hasn't run — never seed empty profiles

        foreach (var sportGroup in metrics.GroupBy(m => m.SportId))
        {
            foreach (var level in Levels)
            {
                var profile = new BenchmarkProfile
                {
                    SportId = sportGroup.Key,
                    Name = level.Name,
                    AgeGroupMin = level.AgeMin,
                    AgeGroupMax = level.AgeMax,
                    CompetitionLevel = level.Comp,
                    IsDefault = true,
                    CoachId = null,
                };
                foreach (var metric in sportGroup)
                {
                    var (low, mid, high) = Calibrate(metric, level);
                    profile.Values.Add(new BenchmarkValue
                    {
                        MetricDefinitionId = metric.Id,
                        BenchmarkLow = low,
                        BenchmarkMid = mid,
                        BenchmarkHigh = high,
                    });
                }
                context.BenchmarkProfiles.Add(profile);
            }
        }
        await context.SaveChangesAsync();
    }

    private static (decimal Low, decimal Mid, decimal High) Calibrate(SportMetricDefinition metric, Level level)
    {
        // Spec-pinned values for the flagship example.
        if (metric.SportId == 1 && metric.Name == "Speed" && SoccerSpeedOverrides.TryGetValue(level.Name, out var pinned))
            return pinned;

        var factor = metric.InputType switch
        {
            MetricInputType.Timer => level.TimerFactor,       // lower = better; youth slower
            MetricInputType.Percentage => level.PercentFactor,
            _ => level.QuantityFactor,                        // Distance / Count / Weight: higher = better
        };

        return (Scale(metric.BenchmarkLow, factor, metric),
                Scale(metric.BenchmarkMid, factor, metric),
                Scale(metric.BenchmarkHigh, factor, metric));
    }

    private static decimal Scale(decimal value, decimal factor, SportMetricDefinition metric)
    {
        var scaled = value * factor;
        if (metric.InputType == MetricInputType.Percentage)
            scaled = Math.Min(scaled, 99m);
        // Keep the precision style of the base value: counts stay whole, timers keep decimals.
        return metric.InputType is MetricInputType.Count or MetricInputType.Distance
            ? Math.Round(scaled)
            : Math.Round(scaled, 2);
    }
}
