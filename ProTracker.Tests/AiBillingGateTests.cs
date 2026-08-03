using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// The AI billing gate (AiBillingGateAttribute → BillingService.EnsureAiAllowedAsync).
// Before the Phase 9 controller split the gate lived on the single AIController via
// IAsyncActionFilter; these tests pin it onto EVERY AI endpoint individually so a
// future controller/route move can never silently drop it.
//
// Mechanism: a freshly registered coach is on the Free plan (Ai: false), so the gate
// throws PlanLimitApiException → 402. The requests use a nonexistent id on purpose —
// getting 402 (not 404) proves the filter runs BEFORE the action body, without ever
// reaching the real AI service.
public class AiBillingGateTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public AiBillingGateTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // All ten AI endpoints (the frontend route contract — see aiApi.ts,
    // nutritionApi.ts, recoveryApi.ts). Any new AI endpoint belongs in this list.
    public static TheoryData<string> AllAiEndpoints => new()
    {
        "/api/ai/improvement-plan/999999",
        "/api/ai/task-suggestions/999999",
        "/api/ai/goal-suggestions/999999",
        "/api/ai/drill-recommendations/999999",
        "/api/ai/nutrition-guidance/999999",
        "/api/ai/weekly-nutrition-plan/999999",
        "/api/ai/recovery-plan/999999",
        "/api/ai/performance-insights/999999",
        "/api/ai/evidence-analysis/999999",
        "/api/ai/team-insights/999999",
    };

    private async Task<HttpClient> RegisterFreeCoachAsync()
    {
        // A brand-new coach has no CoachSubscription row → Free plan → AI blocked.
        var client = _factory.CreateClient();
        var email = $"free.coach.{Guid.NewGuid():N}@gate.test";
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            displayName = "Gate Test Coach",
            email,
            password = "GateTest123!",
            role = "Coach",
        });
        response.EnsureSuccessStatusCode();
        return client;
    }

    [Theory]
    [MemberData(nameof(AllAiEndpoints))]
    public async Task FreePlanCoach_IsBlockedWith402_OnEveryAiEndpoint(string endpoint)
    {
        var client = await RegisterFreeCoachAsync();

        var response = await client.PostAsync(endpoint, content: null);

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Pro and Team plans", body);
    }

    [Fact]
    public async Task ProPlanCoach_PassesTheGate_ActionRuns()
    {
        // Seed coaches are on the Pro plan. A nonexistent player id must come back
        // 404 from the action body — NOT 402 — proving the gate admits paid plans.
        var client = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var response = await client.PostAsync("/api/ai/improvement-plan/999999", content: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SoloAthlete_BypassesThePlanGate()
    {
        // Solo athletes get AI regardless of plan (pinned architecture ruling in
        // BillingService.EnsureAiAllowedAsync). Requesting another player's data must
        // fail on ACCESS (403/404), never on billing (402).
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register-solo", new
        {
            email = $"solo.gate.{Guid.NewGuid():N}@gate.test",
            password = "GateTest123!",
            fullName = "Solo Gate Tester",
            dateOfBirth = "2000-01-15T00:00:00Z",
            height = 180.0,
            weight = 75.0,
            sportId = 1,
            positionId = 1,
            skillLevel = "Intermediate",
            trainingFrequency = "FewTimesWeek",
        });
        register.EnsureSuccessStatusCode();

        var response = await client.PostAsync($"/api/ai/improvement-plan/{TestAuth.LucasWardPlayerId}", content: null);

        Assert.NotEqual(HttpStatusCode.PaymentRequired, response.StatusCode);
        Assert.True(
            response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound,
            $"Expected 403/404 from the access check, got {(int)response.StatusCode}.");
    }
}
