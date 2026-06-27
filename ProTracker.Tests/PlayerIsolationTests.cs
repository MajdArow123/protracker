using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// "Players can only read their own profile, stats, plans, and guidance."
public class PlayerIsolationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public PlayerIsolationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Athlete_CanAccess_OwnPlayerProfile()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync($"/api/players/{TestAuth.LucasWardPlayerId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CannotAccess_AnotherPlayersProfile()
    {
        var lucasClient = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        // Marcus Bell (player 7) is a different athlete's profile.
        var response = await lucasClient.GetAsync($"/api/players/{TestAuth.MarcusBellPlayerId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CannotAccess_AnotherPlayersNutritionGuidance()
    {
        var lucasClient = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        var response = await lucasClient.GetAsync($"/api/players/{TestAuth.MarcusBellPlayerId}/nutrition-guidance");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CannotAccess_AnotherPlayersAssessments()
    {
        var marcusClient = await TestAuth.LoginAsync(_factory, TestAuth.MarcusBellAthleteEmail, TestAuth.SeedPassword);

        var response = await marcusClient.GetAsync($"/api/players/{TestAuth.LucasWardPlayerId}/assessments");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CannotCreate_PlayersOrTeams()
    {
        var lucasClient = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        var response = await lucasClient.PostAsJsonAsync("/api/teams", new { name = "Hacked Team", sportId = 1 });

        // Role-gated endpoint ([Authorize(Roles = "Coach,Admin")]) — Athlete is forbidden outright.
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Athlete_CanAccess_OwnAssessments()
    {
        var lucasClient = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        var response = await lucasClient.GetAsync($"/api/players/{TestAuth.LucasWardPlayerId}/assessments");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<List<AssessmentSummary>>>();
        Assert.NotEmpty(body!.Data!);
    }

    [Fact]
    public async Task Athlete_CannotAccess_AnotherPlayersImprovementPlan()
    {
        var lucasClient = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);

        // Marcus Bell (player 7) is a different athlete — Lucas Ward must not read his plan.
        var response = await lucasClient.GetAsync($"/api/players/{TestAuth.MarcusBellPlayerId}/improvement-plan");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private class AssessmentSummary
    {
        public int Id { get; set; }
    }
}
