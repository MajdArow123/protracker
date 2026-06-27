using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Food alternatives retrieval."
public class FoodAlternativesTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public FoodAlternativesTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAll_ReturnsSeededLibrary()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync("/api/food-alternatives");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<FoodAlternativeShape>>>();
        Assert.True(body!.Data!.Count >= 21); // 5 substitution groups seeded in Phase 2
    }

    [Fact]
    public async Task GetByOriginalFood_ReturnsOnlyMatchingAlternatives()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync("/api/food-alternatives/Eggs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<FoodAlternativeShape>>>();
        Assert.Equal(6, body!.Data!.Count); // Eggs -> 6 alternatives seeded in Phase 2
        Assert.All(body.Data, f => Assert.Equal("Eggs", f.OriginalFood));
    }

    [Fact]
    public async Task GetByOriginalFood_IsCaseInsensitive()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync("/api/food-alternatives/eggs");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<FoodAlternativeShape>>>();
        Assert.Equal(6, body!.Data!.Count);
    }

    [Fact]
    public async Task GetByUnknownFood_ReturnsEmptyList()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync("/api/food-alternatives/Unobtainium");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<FoodAlternativeShape>>>();
        Assert.Empty(body!.Data!);
    }

    private class FoodAlternativeShape
    {
        public string OriginalFood { get; set; } = "";
        public string AlternativeFood { get; set; } = "";
    }
}
