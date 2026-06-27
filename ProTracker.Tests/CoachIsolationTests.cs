using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Coach cannot access another coach's team" — CoachTeamScope enforcement.
public class CoachIsolationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public CoachIsolationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Coach_CanAccess_OwnTeam()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Coach_CannotAccess_AnotherCoachsTeam()
    {
        var basketballCoachClient = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        var response = await basketballCoachClient.GetAsync($"/api/teams/{TestAuth.SoccerTeamId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.False(error!.Success);
    }

    [Fact]
    public async Task Coach_CannotAccess_PlayerOnAnotherCoachsTeam()
    {
        var basketballCoachClient = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        // Liam Carter (player 1) belongs to the soccer team, owned by a different coach.
        var response = await basketballCoachClient.GetAsync($"/api/players/{TestAuth.LiamCarterPlayerId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Coach_ListingTeams_OnlySeesOwnTeams()
    {
        var basketballCoachClient = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);

        var response = await basketballCoachClient.GetAsync("/api/teams");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<TeamShape>>>();
        var teams = body!.Data!;
        Assert.All(teams, t => Assert.Equal(TestAuth.BasketballTeamId, t.Id));
        Assert.DoesNotContain(teams, t => t.Id == TestAuth.SoccerTeamId);
    }

    private class TeamShape
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }
}
