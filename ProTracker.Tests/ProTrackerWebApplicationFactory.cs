using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;

namespace ProTracker.Tests;

// Each test class gets its own fresh SQLite file so seeding/migrations run exactly once per
// class and tests within a class share the same (idempotently-seeded) data set.
//
// ConfigureAppConfiguration overrides are unreliable in .NET 9 WebApplicationFactory for
// minimal-API programs — the app's own WebApplicationBuilder reads the connection string
// before ConfigureAppConfiguration callbacks fire.  Replacing the DbContext registration at
// the service level is the reliable solution.
public class ProTrackerWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"protracker_test_{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            // Remove the app's DbContext registration and replace it with one pointing at
            // a per-class isolated SQLite file.  This is authoritative: every DI consumer
            // (startup seed code, request pipeline, Identity stores) gets the test database.
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlite($"DataSource={_dbPath}"));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try
        {
            if (File.Exists(_dbPath)) File.Delete(_dbPath);
            if (File.Exists(_dbPath + "-shm")) File.Delete(_dbPath + "-shm");
            if (File.Exists(_dbPath + "-wal")) File.Delete(_dbPath + "-wal");
        }
        catch { /* best-effort cleanup */ }
    }
}
