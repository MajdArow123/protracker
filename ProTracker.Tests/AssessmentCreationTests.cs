using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Assessment creation and retrieval."
public class AssessmentCreationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public AssessmentCreationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateAssessment_ThenRetrieveIt_ReturnsMatchingData()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var createResponse = await client.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = TestAuth.LiamCarterPlayerId,
            assessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId,
            dateRecorded = DateTime.UtcNow,
            notes = "Integration test assessment.",
            statScores = new[]
            {
                new { playerAssessmentId = 0, sportStatCategoryId = 1, score = 7 },
                new { playerAssessmentId = 0, sportStatCategoryId = 2, score = 9 }
            }
        });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<TestApiResponse<AssessmentShape>>();
        Assert.NotNull(created!.Data);
        Assert.Equal(TestAuth.LiamCarterPlayerId, created.Data!.PlayerId);
        Assert.Equal(2, created.Data.StatScores.Count);

        var getResponse = await client.GetAsync($"/api/player-assessments/{created.Data.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<TestApiResponse<AssessmentShape>>();
        Assert.Equal("Integration test assessment.", fetched!.Data!.Notes);
        Assert.Contains(fetched.Data.StatScores, s => s.SportStatCategoryId == 1 && s.Score == 7);
        Assert.Contains(fetched.Data.StatScores, s => s.SportStatCategoryId == 2 && s.Score == 9);
    }

    [Fact]
    public async Task GetAssessmentsForPlayer_ReturnsCreatedAssessment()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var createResponse = await client.PostAsJsonAsync("/api/player-assessments", new
        {
            playerId = TestAuth.NoahBennettPlayerId,
            assessmentPeriodId = TestAuth.FirstSoccerAssessmentPeriodId,
            dateRecorded = DateTime.UtcNow,
            notes = "Second test assessment.",
            statScores = Array.Empty<object>()
        });
        createResponse.EnsureSuccessStatusCode();

        var listResponse = await client.GetAsync($"/api/players/{TestAuth.NoahBennettPlayerId}/assessments");
        listResponse.EnsureSuccessStatusCode();

        var list = await listResponse.Content.ReadFromJsonAsync<TestApiResponse<List<AssessmentShape>>>();
        Assert.Contains(list!.Data!, a => a.Notes == "Second test assessment.");
    }

    private class AssessmentShape
    {
        public int Id { get; set; }
        public int PlayerId { get; set; }
        public string? Notes { get; set; }
        public List<StatScoreShape> StatScores { get; set; } = new();
    }

    private class StatScoreShape
    {
        public int SportStatCategoryId { get; set; }
        public int Score { get; set; }
    }
}
