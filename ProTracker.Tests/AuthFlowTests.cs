using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

public class AuthFlowTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public AuthFlowTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_WithValidCredentials_Succeeds_AndSetsAuthCookies()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = TestAuth.SoccerCoachEmail, password = TestAuth.SeedPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<LoginResponseShape>>();
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.Equal(TestAuth.SoccerCoachEmail, body.Data!.User.Email);
        Assert.Contains("Coach", body.Data.User.Roles);

        Assert.True(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = TestAuth.SoccerCoachEmail, password = "WrongPassword123!" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<TestApiError>();
        Assert.False(error!.Success);
    }

    [Fact]
    public async Task Me_WithoutLogin_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_AfterLogin_ReturnsCurrentUser()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TestApiResponse<UserInfoShape>>();
        Assert.Equal(TestAuth.SoccerCoachEmail, body!.Data!.Email);
    }

    [Fact]
    public async Task Logout_RevokesSession_SubsequentMeFails()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var logoutResponse = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);

        // Access token cookie is cleared, so /me (which requires it) should now be unauthorized.
        var meResponse = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meResponse.StatusCode);
    }

    [Fact]
    public async Task Refresh_WithValidRefreshCookie_IssuesNewAccessToken()
    {
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var refreshResponse = await client.PostAsync("/api/auth/refresh", null);
        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);

        // The rotated cookie should still authenticate successfully.
        var meResponse = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutAuthCookie_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/teams");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private class LoginResponseShape
    {
        public UserInfoShape User { get; set; } = null!;
    }

    private class UserInfoShape
    {
        public string Id { get; set; } = "";
        public string Email { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public List<string> Roles { get; set; } = new();
    }
}
