using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Data.Showcase;

namespace ProTracker.Controllers.Api;

// Admin-only demo showcase seeding. NOT role-gated (no admin login exists in the
// demo): access requires the X-Seed-Token header to match the SEED_ADMIN_TOKEN
// environment variable. When the variable is unset the endpoint is dead — every
// request 403s — so a deployment can't be seeded by accident.
[ApiController]
[Route("api/admin/demo-showcase")]
[AllowAnonymous]
public class DemoShowcaseController : ApiControllerBase
{
    private readonly DemoShowcaseSeeder _seeder;
    private readonly IConfiguration _config;

    public DemoShowcaseController(DemoShowcaseSeeder seeder, IConfiguration config)
    {
        _seeder = seeder;
        _config = config;
    }

    public record SeedRequest(string Phase = "soccer", bool DryRun = true);
    public record TeardownRequest(bool DryRun = true);

    private bool Authorized()
    {
        var expected = Environment.GetEnvironmentVariable("SEED_ADMIN_TOKEN") ?? _config["SEED_ADMIN_TOKEN"];
        if (string.IsNullOrWhiteSpace(expected)) return false;
        return Request.Headers.TryGetValue("X-Seed-Token", out var got) && got == expected;
    }

    [HttpPost("")]
    public async Task<ActionResult> Seed([FromBody] SeedRequest request)
    {
        // Raw 403 — Forbid() would invoke the auth handler's redirect flow.
        if (!Authorized()) return StatusCode(StatusCodes.Status403Forbidden);
        var report = await _seeder.RunAsync(request.Phase, request.DryRun);
        return Success(report);
    }

    [HttpPost("teardown")]
    public async Task<ActionResult> Teardown([FromBody] TeardownRequest request)
    {
        // Raw 403 — Forbid() would invoke the auth handler's redirect flow.
        if (!Authorized()) return StatusCode(StatusCodes.Status403Forbidden);
        var report = await _seeder.TeardownAsync(request.DryRun);
        return Success(report);
    }
}
