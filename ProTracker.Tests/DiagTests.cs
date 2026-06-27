using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

public class DiagTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    public DiagTests(ProTrackerWebApplicationFactory factory) { _factory = factory; }

    [Fact]
    public async Task Diag_CoachLoginWorks()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/login", new { email = TestAuth.SoccerCoachEmail, password = TestAuth.SeedPassword });
        var body = await resp.Content.ReadAsStringAsync();
        Assert.True(resp.IsSuccessStatusCode, $"Coach login status={resp.StatusCode} body={body}");
    }

    [Fact]
    public async Task Diag_AthleteLoginWorks()
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/auth/login", new { email = TestAuth.LucasWardAthleteEmail, password = TestAuth.SeedPassword });
        var body = await resp.Content.ReadAsStringAsync();
        Assert.True(resp.IsSuccessStatusCode, $"Athlete login status={resp.StatusCode} body={body}");
    }
}
