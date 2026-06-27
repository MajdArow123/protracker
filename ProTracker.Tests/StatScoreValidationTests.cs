using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Stat scores must be 1-10 (validation test)."
public class StatScoreValidationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public StatScoreValidationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    [InlineData(-5)]
    public async Task CreateStatScore_OutOfRange_ReturnsBadRequest(int invalidScore)
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.PostAsJsonAsync("/api/stat-scores", new
        {
            playerAssessmentId = 1,
            sportStatCategoryId = 1,
            score = invalidScore
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.False(error!.Success);
        Assert.Contains(error.Errors, e => e.Contains("between 1 and 10"));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(10)]
    public async Task CreateStatScore_InRange_Succeeds(int validScore)
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.PostAsJsonAsync("/api/stat-scores", new
        {
            playerAssessmentId = 1,
            sportStatCategoryId = 2,
            score = validScore
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
