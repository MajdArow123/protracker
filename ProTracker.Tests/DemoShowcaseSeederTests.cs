using System.Net;
using System.Net.Http.Json;

namespace ProTracker.Tests;

// Safety contract of the on-demand showcase seeder: token-gated, dry-run writes
// nothing, real runs are idempotent, teardown previews without deleting.
public class DemoShowcaseSeederTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private const string Token = "test-seed-token";
    private readonly ProTrackerWebApplicationFactory _factory;

    public DemoShowcaseSeederTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
        Environment.SetEnvironmentVariable("SEED_ADMIN_TOKEN", Token);
    }

    private HttpClient Client(bool withToken = true)
    {
        var c = _factory.CreateClient();
        if (withToken) c.DefaultRequestHeaders.Add("X-Seed-Token", Token);
        return c;
    }

    private sealed class ReportShape
    {
        public string Phase { get; set; } = "";
        public bool DryRun { get; set; }
        public Dictionary<string, int> Created { get; set; } = new();
        public Dictionary<string, int> Existing { get; set; } = new();
        public List<string> Notes { get; set; } = new();
    }

    private async Task<int> CountPlayersAsync()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var players = await coach.GetFromJsonAsync<TestApiResponse<List<PlayerShape>>>("/api/players");
        return players!.Data!.Count;
    }

    private sealed class PlayerShape { public int Id { get; set; } }

    [Fact]
    public async Task Seed_WithoutToken_IsForbidden()
    {
        var response = await Client(withToken: false)
            .PostAsJsonAsync("/api/admin/demo-showcase", new { phase = "soccer", dryRun = true });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var wrongToken = _factory.CreateClient();
        wrongToken.DefaultRequestHeaders.Add("X-Seed-Token", "wrong");
        var response2 = await wrongToken.PostAsJsonAsync("/api/admin/demo-showcase", new { phase = "soccer", dryRun = true });
        Assert.Equal(HttpStatusCode.Forbidden, response2.StatusCode);
    }

    [Fact]
    public async Task Seed_DryRun_RealRun_Idempotency_And_TeardownPreview()
    {
        var client = Client();

        // 1) Dry run: reports work but writes nothing.
        var before = await CountPlayersAsync();
        var dry = await client.PostAsJsonAsync("/api/admin/demo-showcase", new { phase = "soccer", dryRun = true });
        dry.EnsureSuccessStatusCode();
        var dryReport = (await dry.Content.ReadFromJsonAsync<TestApiResponse<ReportShape>>())!.Data!;
        Assert.True(dryReport.DryRun);
        Assert.True(dryReport.Created.GetValueOrDefault("Player") > 0, "dry run should plan new players");
        Assert.Equal(before, await CountPlayersAsync()); // nothing written

        // 2) Real run: creates the roster.
        var real = await client.PostAsJsonAsync("/api/admin/demo-showcase", new { phase = "soccer", dryRun = false });
        real.EnsureSuccessStatusCode();
        var realReport = (await real.Content.ReadFromJsonAsync<TestApiResponse<ReportShape>>())!.Data!;
        Assert.True(realReport.Created.GetValueOrDefault("Player") > 0);
        var afterFirst = await CountPlayersAsync();
        Assert.True(afterFirst > before);

        // 3) Second real run: fully idempotent — zero new rows anywhere
        //    (the evidence recalc pass is an upsert and re-runs by design).
        var again = await client.PostAsJsonAsync("/api/admin/demo-showcase", new { phase = "soccer", dryRun = false });
        again.EnsureSuccessStatusCode();
        var againReport = (await again.Content.ReadFromJsonAsync<TestApiResponse<ReportShape>>())!.Data!;
        var unexpected = againReport.Created.Where(kv => kv.Value > 0 && kv.Key != "EvidenceRecalc(players)").ToList();
        Assert.True(unexpected.Count == 0,
            "second run must create nothing, but created: " + string.Join(", ", unexpected.Select(kv => $"{kv.Key}={kv.Value}")));
        Assert.Equal(afterFirst, await CountPlayersAsync());

        // 4) Teardown dry run: previews deletions without deleting.
        var teardown = await client.PostAsJsonAsync("/api/admin/demo-showcase/teardown", new { dryRun = true });
        teardown.EnsureSuccessStatusCode();
        var teardownReport = (await teardown.Content.ReadFromJsonAsync<TestApiResponse<ReportShape>>())!.Data!;
        Assert.True(teardownReport.Created.GetValueOrDefault("Players(deleted, children cascade)") >= afterFirst - 5);
        Assert.Equal(afterFirst, await CountPlayersAsync()); // still all there
    }
}
