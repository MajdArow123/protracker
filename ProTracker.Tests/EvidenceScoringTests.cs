using System.Net;
using System.Net.Http.Json;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Tests;

// Pure-math unit tests for EvidenceScoringEngine (no database).
public class EvidenceScoringEngineTests
{
    // ─── Normalization: ascending benchmarks (higher = better) ───────────────

    [Theory]
    [InlineData(2600, 5.0)]   // mid anchor → 5
    [InlineData(3200, 10.0)]  // high anchor → 10
    [InlineData(2000, 3.0)]   // low anchor → 3
    [InlineData(2900, 7.5)]   // halfway mid→high
    [InlineData(2300, 4.0)]   // halfway low→mid
    [InlineData(500, 1.0)]    // far below low clamps at 1
    [InlineData(9999, 10.0)]  // above high clamps at 10
    public void Normalize_AscendingBenchmarks(decimal value, decimal expected)
    {
        var score = EvidenceScoringEngine.NormalizeObjectiveValue(value, 2000, 2600, 3200);
        Assert.Equal(expected, score);
    }

    // ─── Normalization: descending benchmarks (lower = better, e.g. sprint) ──

    [Theory]
    [InlineData(4.3, 5.0)]
    [InlineData(3.8, 10.0)]
    [InlineData(4.8, 3.0)]
    [InlineData(4.05, 7.5)]
    [InlineData(6.0, 1.0)]   // very slow clamps at 1
    [InlineData(3.0, 10.0)]  // faster than elite clamps at 10
    public void Normalize_DescendingBenchmarks(decimal value, decimal expected)
    {
        var score = EvidenceScoringEngine.NormalizeObjectiveValue(value, 4.8m, 4.3m, 3.8m);
        Assert.Equal(expected, score);
    }

    [Fact]
    public void Normalize_RatingInputType_UsesValueDirectly()
    {
        var def = new SportMetricDefinition { InputType = MetricInputType.Rating, BenchmarkLow = 3, BenchmarkMid = 5, BenchmarkHigh = 10 };
        Assert.Equal(7.5m, EvidenceScoringEngine.NormalizeObjectiveValue(7.5m, def));
        Assert.Equal(10m, EvidenceScoringEngine.NormalizeObjectiveValue(15m, def)); // clamped
    }

    // ─── Weight redistribution when evidence is missing ──────────────────────

    private static SportMetricDefinition DefaultWeights() => new()
    {
        ObjectiveTestWeight = 0.4m,
        MatchStatWeight = 0.3m,
        CoachEvalWeight = 0.2m,
        SelfAssessWeight = 0.1m,
    };

    [Fact]
    public void RedistributeWeights_AllPresent_KeepsConfiguredWeights()
    {
        var (obj, match, coach, self) = EvidenceScoringEngine.RedistributeWeights(
            DefaultWeights(), true, true, true, true);
        Assert.Equal(0.4m, obj);
        Assert.Equal(0.3m, match);
        Assert.Equal(0.2m, coach);
        Assert.Equal(0.1m, self);
    }

    [Fact]
    public void RedistributeWeights_MissingSources_RedistributesProportionally()
    {
        // Only objective + coach present: 0.4 and 0.2 rescale to sum 1.
        var (obj, match, coach, self) = EvidenceScoringEngine.RedistributeWeights(
            DefaultWeights(), true, false, true, false);
        Assert.Equal(0m, match);
        Assert.Equal(0m, self);
        Assert.Equal(0.6667m, Math.Round(obj, 4));
        Assert.Equal(0.3333m, Math.Round(coach, 4));
        Assert.Equal(1m, Math.Round(obj + coach, 4));
    }

    [Fact]
    public void RedistributeWeights_NothingPresent_AllZero()
    {
        var (obj, match, coach, self) = EvidenceScoringEngine.RedistributeWeights(
            DefaultWeights(), false, false, false, false);
        Assert.Equal(0m, obj + match + coach + self);
    }

    // ─── Confidence levels ────────────────────────────────────────────────────

    [Theory]
    [InlineData(true, true, true, true, false, EvidenceConfidence.VeryHigh)]
    [InlineData(true, false, true, false, false, EvidenceConfidence.High)]   // objective + coach
    [InlineData(false, true, true, true, false, EvidenceConfidence.High)]    // 3 sources
    [InlineData(false, false, true, true, false, EvidenceConfidence.Medium)] // coach + one other
    [InlineData(true, true, false, false, false, EvidenceConfidence.Medium)] // 2 sources, no coach
    [InlineData(false, false, true, false, false, EvidenceConfidence.Low)]   // coach only
    [InlineData(false, false, false, true, false, EvidenceConfidence.Low)]   // self only
    [InlineData(false, true, true, true, true, EvidenceConfidence.Low)]      // objective required & missing
    [InlineData(true, true, true, true, true, EvidenceConfidence.VeryHigh)]  // objective required & present
    public void GetConfidenceLevel_MatchesSpec(bool obj, bool match, bool coach, bool self,
        bool objectiveRequired, EvidenceConfidence expected)
    {
        Assert.Equal(expected, EvidenceScoringEngine.GetConfidenceLevel(obj, match, coach, self, objectiveRequired));
    }

    [Theory]
    [InlineData(false, false, true, false, ScoreCalculationMethod.Manual)]
    [InlineData(true, false, false, false, ScoreCalculationMethod.Calculated)]
    [InlineData(true, false, true, false, ScoreCalculationMethod.Hybrid)]
    public void GetCalculationMethod_MatchesSpec(bool obj, bool match, bool coach, bool self,
        ScoreCalculationMethod expected)
    {
        Assert.Equal(expected, EvidenceScoringEngine.GetCalculationMethod(obj, match, coach, self));
    }

    // ─── Match stat mapping ───────────────────────────────────────────────────

    [Fact]
    public void ScoreFromMatchStats_SoccerPassing_AveragesAndNormalizes()
    {
        var entries = new List<Dictionary<string, decimal>>
        {
            new(StringComparer.OrdinalIgnoreCase) { ["passAccuracy"] = 60 },
            new(StringComparer.OrdinalIgnoreCase) { ["passAccuracy"] = 80 },
        };
        // avg 70 = mid anchor (50/70/90) → 5.0
        Assert.Equal(5.0m, EvidenceScoringEngine.ScoreFromMatchStats(1, "Passing", entries));
    }

    [Fact]
    public void ScoreFromMatchStats_NoMappingOrNoData_ReturnsNull()
    {
        var empty = new List<Dictionary<string, decimal>> { new(StringComparer.OrdinalIgnoreCase) };
        Assert.Null(EvidenceScoringEngine.ScoreFromMatchStats(1, "Passing", empty));            // no keys
        Assert.Null(EvidenceScoringEngine.ScoreFromMatchStats(1, "Weak Foot", empty));           // no rule
        Assert.Null(EvidenceScoringEngine.ScoreFromMatchStats(1, "Passing", new List<Dictionary<string, decimal>>()));
    }

    [Fact]
    public void ParseStatsJson_IgnoresNonNumericAndMalformed()
    {
        var stats = EvidenceScoringEngine.ParseStatsJson("""{"goals":2,"note":"great","passAccuracy":81.5}""");
        Assert.Equal(2, stats.Count);
        Assert.Equal(81.5m, stats["passAccuracy"]);
        Assert.Empty(EvidenceScoringEngine.ParseStatsJson("not json"));
    }
}

// End-to-end API tests: evidence entry → calculation → slider-assessment auto-evidence.
public class EvidenceApiTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public EvidenceApiTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<MetricShape> GetSoccerMetricAsync(HttpClient client, string name)
    {
        var response = await client.GetFromJsonAsync<TestApiResponse<List<MetricShape>>>("/api/sport-metrics/1");
        return response!.Data!.First(m => m.Name == name);
    }

    [Fact]
    public async Task GetSportMetrics_ReturnsSeededSoccerMetrics()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var response = await client.GetFromJsonAsync<TestApiResponse<List<MetricShape>>>("/api/sport-metrics/1");

        Assert.Equal(11, response!.Data!.Count);
        var speed = response.Data.First(m => m.Name == "Speed");
        Assert.True(speed.IsObjectiveRequired);
        Assert.Equal("Timer", speed.InputType);
        Assert.Equal(1, speed.SportStatCategoryId); // linked to the Speed slider category
    }

    [Fact]
    public async Task FullSoccerSpeedCalculation_ObjectiveThenCoachEval_RaisesScoreAndConfidence()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var speed = await GetSoccerMetricAsync(client, "Speed");

        // 1. Objective test: 4.3s 30m sprint = the mid benchmark → normalizes to 5.0.
        var testResponse = await client.PostAsJsonAsync("/api/objective-tests", new
        {
            playerId = TestAuth.LiamCarterPlayerId,
            metricDefinitionId = speed.Id,
            value = 4.3,
            notes = "Evidence integration test",
        });
        Assert.Equal(HttpStatusCode.Created, testResponse.StatusCode);
        var test = await testResponse.Content.ReadFromJsonAsync<TestApiResponse<ObjectiveTestShape>>();
        Assert.Equal(5.0m, test!.Data!.NormalizedScore);
        Assert.Equal("seconds", test.Data.Unit); // defaulted from the metric definition

        // Objective only (single source) → Low confidence, Calculated method.
        var calc1 = await client.PostAsync($"/api/evidence-scores/calculate/{TestAuth.LiamCarterPlayerId}/{speed.Id}", null);
        var score1 = (await calc1.Content.ReadFromJsonAsync<TestApiResponse<ScoreShape>>())!.Data!;
        Assert.Equal(5.0m, score1.FinalScore);
        Assert.Equal("Low", score1.Confidence);
        Assert.Equal("Calculated", score1.CalculationMethod);
        Assert.Contains(score1.MissingEvidence, m => m.Contains("coach evaluation"));

        // 2. Coach evaluation of 7 → weights redistribute to 0.4:0.2 → 5*2/3 + 7*1/3 = 5.7.
        var evalResponse = await client.PostAsJsonAsync("/api/coach-evaluations", new
        {
            playerId = TestAuth.LiamCarterPlayerId,
            metricDefinitionId = speed.Id,
            rating = 7,
        });
        Assert.Equal(HttpStatusCode.Created, evalResponse.StatusCode);

        var calc2 = await client.PostAsync($"/api/evidence-scores/calculate/{TestAuth.LiamCarterPlayerId}/{speed.Id}", null);
        var score2 = (await calc2.Content.ReadFromJsonAsync<TestApiResponse<ScoreShape>>())!.Data!;
        Assert.Equal(5.7m, score2.FinalScore);
        Assert.Equal("High", score2.Confidence); // objective + coach
        Assert.Equal("Hybrid", score2.CalculationMethod);
        Assert.NotNull(score2.Explanation);

        // The upsert keeps one current row per player+metric.
        var listResponse = await client.GetFromJsonAsync<TestApiResponse<List<ScoreShape>>>(
            $"/api/players/{TestAuth.LiamCarterPlayerId}/evidence-scores");
        Assert.Single(listResponse!.Data!, s => s.MetricDefinitionId == speed.Id);
    }

    [Fact]
    public async Task MatchStats_ContributeToPassingScore()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var passing = await GetSoccerMetricAsync(client, "Passing");

        var statResponse = await client.PostAsJsonAsync("/api/match-stats", new
        {
            playerId = TestAuth.NoahBennettPlayerId,
            stats = new Dictionary<string, decimal> { ["passes"] = 42, ["passAccuracy"] = 90, ["goals"] = 1 },
        });
        Assert.Equal(HttpStatusCode.Created, statResponse.StatusCode);

        var calc = await client.PostAsync($"/api/evidence-scores/calculate/{TestAuth.NoahBennettPlayerId}/{passing.Id}", null);
        var score = (await calc.Content.ReadFromJsonAsync<TestApiResponse<ScoreShape>>())!.Data!;
        Assert.Equal(10.0m, score.MatchStatScore); // 90% = high anchor
    }

    [Fact]
    public async Task SliderAssessment_AutoCreatesCoachEvaluationEvidence()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var createResponse = await client.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = TestAuth.LucasWardPlayerId,
            assessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId,
            dateRecorded = DateTime.UtcNow,
            notes = "Evidence auto-capture test.",
            statScores = new[]
            {
                new { playerAssessmentId = 0, sportStatCategoryId = 1, score = 7.5 }, // Speed
                new { playerAssessmentId = 0, sportStatCategoryId = 3, score = 6.0 }, // Passing
            }
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var evals = await client.GetFromJsonAsync<TestApiResponse<List<CoachEvalShape>>>(
            $"/api/players/{TestAuth.LucasWardPlayerId}/coach-evaluations");
        Assert.Contains(evals!.Data!, e => e.MetricName == "Speed" && e.Rating == 7.5m);
        Assert.Contains(evals.Data!, e => e.MetricName == "Passing" && e.Rating == 6.0m);
    }

    [Fact]
    public async Task Athlete_CannotPostCoachEvaluation()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        var response = await client.PostAsJsonAsync("/api/coach-evaluations", new
        {
            playerId = TestAuth.LucasWardPlayerId,
            metricDefinitionId = 1,
            rating = 9,
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CanSelfAssess_OwnMetricOnly()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        var passing = await GetSoccerMetricAsync(client, "Passing");

        var response = await client.PostAsJsonAsync("/api/self-assessments/evidence", new
        {
            metricDefinitionId = passing.Id,
            rating = 8,
            notes = "Feeling sharp in training.",
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var entry = await response.Content.ReadFromJsonAsync<TestApiResponse<SelfAssessShape>>();
        Assert.Equal(TestAuth.LucasWardPlayerId, entry!.Data!.PlayerId); // always the caller's player
    }

    [Fact]
    public async Task SavingMatchRatings_AutoImportsEvidenceMatchStats()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Log a match, then rate a player with sport-specific stats.
        var matchResponse = await client.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/matches", new
        {
            opponentName = "AutoImport FC",
            matchDate = DateTime.UtcNow.Date,
            homeScore = 2,
            awayScore = 1,
            isHome = true,
        });
        Assert.Equal(HttpStatusCode.Created, matchResponse.StatusCode);
        var match = await matchResponse.Content.ReadFromJsonAsync<TestApiResponse<MatchShape>>();
        var matchId = match!.Data!.Id;

        var ratingsResponse = await client.PostAsJsonAsync($"/api/matches/{matchId}/ratings", new
        {
            ratings = new[]
            {
                new { playerId = TestAuth.LiamCarterPlayerId, rating = 7.5,
                      statJson = """{"goals":1,"passes":40,"passAccuracy":82,"minutesPlayed":90}""" },
                // All-zero stats (unused sub): must NOT be imported.
                new { playerId = TestAuth.NoahBennettPlayerId, rating = 6.0,
                      statJson = """{"goals":0,"passes":0,"passAccuracy":0,"minutesPlayed":90}""" },
            }
        });
        Assert.Equal(HttpStatusCode.OK, ratingsResponse.StatusCode);

        // Rated player got an auto-imported evidence entry with the stats + rating.
        var entries = await client.GetFromJsonAsync<TestApiResponse<List<MatchStatShape>>>(
            $"/api/players/{TestAuth.LiamCarterPlayerId}/match-stats");
        var imported = entries!.Data!.FirstOrDefault(e => e.MatchResultId == matchId);
        Assert.NotNull(imported);
        Assert.True(imported!.IsAutoImported);
        Assert.Equal(82, imported.Stats["passAccuracy"]);
        Assert.Equal(7.5m, imported.Stats["rating"]);

        // The empty-stats player was skipped.
        var noahEntries = await client.GetFromJsonAsync<TestApiResponse<List<MatchStatShape>>>(
            $"/api/players/{TestAuth.NoahBennettPlayerId}/match-stats");
        Assert.DoesNotContain(noahEntries!.Data!, e => e.MatchResultId == matchId);

        // Re-saving ratings without the player removes the auto entry (replace semantics).
        var clearResponse = await client.PostAsJsonAsync($"/api/matches/{matchId}/ratings", new
        {
            ratings = Array.Empty<object>(),
        });
        Assert.Equal(HttpStatusCode.OK, clearResponse.StatusCode);
        var after = await client.GetFromJsonAsync<TestApiResponse<List<MatchStatShape>>>(
            $"/api/players/{TestAuth.LiamCarterPlayerId}/match-stats");
        Assert.DoesNotContain(after!.Data!, e => e.MatchResultId == matchId);
    }

    [Fact]
    public async Task ObjectiveTest_WrongSportMetric_ReturnsBadRequest()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        // Basketball's Vertical Jump against a soccer player must fail.
        var metrics = await client.GetFromJsonAsync<TestApiResponse<List<MetricShape>>>("/api/sport-metrics/2");
        var jump = metrics!.Data!.First(m => m.Name == "Vertical Jump");

        var response = await client.PostAsJsonAsync("/api/objective-tests", new
        {
            playerId = TestAuth.LiamCarterPlayerId,
            metricDefinitionId = jump.Id,
            value = 60,
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Response shapes (subset of the DTO fields the tests assert on).
    public class MetricShape
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string InputType { get; set; } = "";
        public bool IsObjectiveRequired { get; set; }
        public int? SportStatCategoryId { get; set; }
    }

    public class ObjectiveTestShape
    {
        public int Id { get; set; }
        public decimal NormalizedScore { get; set; }
        public string Unit { get; set; } = "";
    }

    public class ScoreShape
    {
        public int MetricDefinitionId { get; set; }
        public decimal FinalScore { get; set; }
        public string Confidence { get; set; } = "";
        public string CalculationMethod { get; set; } = "";
        public decimal? MatchStatScore { get; set; }
        public string? Explanation { get; set; }
        public List<string> MissingEvidence { get; set; } = new();
    }

    public class CoachEvalShape
    {
        public string MetricName { get; set; } = "";
        public decimal Rating { get; set; }
    }

    public class SelfAssessShape
    {
        public int PlayerId { get; set; }
    }

    public class MatchShape
    {
        public int Id { get; set; }
    }

    public class MatchStatShape
    {
        public int Id { get; set; }
        public int? MatchResultId { get; set; }
        public bool IsAutoImported { get; set; }
        public Dictionary<string, decimal> Stats { get; set; } = new();
    }
}
