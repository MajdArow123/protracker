using System.Net;
using System.Net.Http.Json;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Tests;

// Pure-math unit tests for the team performance rollup (no database).
public class TeamPerformanceMathTests
{
    private static TeamMetricOutlierDto P(int id, decimal score) =>
        new() { PlayerId = id, PlayerName = $"P{id}", Score = score };

    // ─── Score bands (must mirror chartColors.ts scoreTone: <5 / <7 / ≥7) ────

    [Fact]
    public void CountBands_BoundariesMatchScoreTone()
    {
        var bands = TeamPerformanceMath.CountBands(new[] { 4.9m, 5.0m, 6.9m, 7.0m, 10m, 1m });
        Assert.Equal(2, bands.Red);    // 4.9, 1
        Assert.Equal(2, bands.Amber);  // 5.0 (boundary up), 6.9
        Assert.Equal(2, bands.Green);  // 7.0 (boundary up), 10
    }

    // ─── Sample standard deviation (n-1) + thin-coverage gate ────────────────

    [Fact]
    public void SampleStdDev_UsesSampleFormula()
    {
        // mean 7; squared deviations 9+1+1+9 = 20; sample variance 20/3; sd ≈ 2.58
        Assert.Equal(2.58m, TeamPerformanceMath.SampleStdDev(new[] { 4m, 6m, 8m, 10m }));
    }

    [Fact]
    public void SampleStdDev_NullBelowMinimumCount()
    {
        Assert.Null(TeamPerformanceMath.SampleStdDev(new[] { 4m, 6m, 8m }));
        Assert.NotNull(TeamPerformanceMath.SampleStdDev(new[] { 4m, 6m, 8m, 10m }));
    }

    [Fact]
    public void SampleStdDev_ZeroForIdenticalScores()
    {
        Assert.Equal(0m, TeamPerformanceMath.SampleStdDev(new[] { 6m, 6m, 6m, 6m }));
    }

    // ─── Outliers: notably-far only, capped, suppressed on thin coverage ─────

    [Fact]
    public void PickOutliers_RequiresNotableDistance()
    {
        // avg 6.0: 4.6 is 1.4 away (excluded), 4.5 is exactly 1.5 (included).
        var scored = new[] { P(1, 4.6m), P(2, 4.5m), P(3, 6.0m), P(4, 7.4m), P(5, 7.5m) };
        var (low, high) = TeamPerformanceMath.PickOutliers(scored, 6.0m);
        Assert.Single(low);
        Assert.Equal(2, low[0].PlayerId);
        Assert.Single(high);
        Assert.Equal(5, high[0].PlayerId);
    }

    [Fact]
    public void PickOutliers_CapsAtTwoPerSide_WorstFirst()
    {
        var scored = new[] { P(1, 1m), P(2, 2m), P(3, 3m), P(4, 8m), P(5, 8m), P(6, 8m) };
        var (low, _) = TeamPerformanceMath.PickOutliers(scored, 8m);
        Assert.Equal(2, low.Count);
        Assert.Equal(1, low[0].PlayerId); // lowest first
        Assert.Equal(2, low[1].PlayerId);
    }

    [Fact]
    public void PickOutliers_SuppressedBelowThreePlayers()
    {
        var scored = new[] { P(1, 1m), P(2, 9m) };
        var (low, high) = TeamPerformanceMath.PickOutliers(scored, 5m);
        Assert.Empty(low);
        Assert.Empty(high);
    }
}

// Integration: seeded team → real rollup through the endpoint.
public class TeamPerformanceEndpointTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public TeamPerformanceEndpointTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private const int SpeedMetricId = 1;

    [Fact]
    public async Task TeamPerformance_RollsUpScoresWithCoverageDenominators()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Create current evidence scores for two players on Speed: a test + explicit recalc
        // (posting a test alone does not persist a current score row).
        foreach (var (playerId, seconds) in new[] { (TestAuth.LiamCarterPlayerId, 4.3m), (TestAuth.NoahBennettPlayerId, 4.8m) })
        {
            var post = await client.PostAsJsonAsync("/api/objective-tests", new
            {
                playerId,
                metricDefinitionId = SpeedMetricId,
                value = seconds,
                testedAt = DateTime.UtcNow.Date,
            });
            post.EnsureSuccessStatusCode();
            var recalc = await client.PostAsync($"/api/evidence-scores/calculate/{playerId}/{SpeedMetricId}", null);
            recalc.EnsureSuccessStatusCode();
        }

        var response = await client.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}/evidence-performance");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<TeamEvidencePerformanceDto>>();
        var data = body!.Data!;

        Assert.Equal(TestAuth.SoccerTeamId, data.TeamId);
        Assert.True(data.SquadSize >= 2);

        // Every sport metric is present, including unscored ones (honest gaps).
        var speed = Assert.Single(data.Metrics, m => m.MetricDefinitionId == SpeedMetricId);
        Assert.True(speed.ScoredCount >= 2);
        Assert.True(speed.ScoredCount <= data.SquadSize);
        Assert.NotNull(speed.Average);
        Assert.NotNull(speed.Min);
        Assert.NotNull(speed.Max);
        Assert.True(speed.Min <= speed.Average && speed.Average <= speed.Max);
        // Band counts always partition exactly the scored players.
        Assert.Equal(speed.ScoredCount, speed.BandCounts.Red + speed.BandCounts.Amber + speed.BandCounts.Green);
        Assert.InRange(speed.BelowAverageCount, 0, speed.ScoredCount);
        Assert.InRange(speed.VerifiedCount, 0, speed.ScoredCount);
        // StdDev is gated on >= 4 scored players.
        if (speed.ScoredCount < TeamPerformanceMath.MinScoredForStdDev) Assert.Null(speed.StdDev);

        // A metric nobody has scored reports honest nulls, not zeros-as-data.
        var unscored = data.Metrics.FirstOrDefault(m => m.ScoredCount == 0);
        if (unscored != null)
        {
            Assert.Null(unscored.Average);
            Assert.Null(unscored.StdDev);
            Assert.Empty(unscored.LowOutliers);
            Assert.Empty(unscored.HighOutliers);
        }
    }

    [Fact]
    public async Task TeamPerformance_DeniedForOtherCoach()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        var response = await client.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}/evidence-performance");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
