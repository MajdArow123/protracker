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
            //
            // AddDbContext in modern EF Core registers both the built DbContextOptions<T>
            // singleton AND an IDbContextOptionsConfiguration<T> entry (the incremental
            // configuration delegate). Removing only the former still leaves the app's
            // Npgsql configuration delegate registered, so the options end up configured
            // for both providers at once ("Multiple relational database provider
            // configurations found") — both descriptor kinds must go.
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                (d.ServiceType.IsGenericType &&
                 d.ServiceType.FullName != null &&
                 d.ServiceType.FullName.Contains("DbContextOptionsConfiguration") &&
                 d.ServiceType.GenericTypeArguments.Contains(typeof(ApplicationDbContext))))
                .ToList();
            foreach (var d in toRemove)
                services.Remove(d);

            // An isolated internal service provider keeps this DbContext's SQLite services
            // separate from the app's ambient Npgsql provider registrations.
            //
            // The committed migrations were generated against Npgsql, so their snapshot
            // carries Npgsql-specific annotations (e.g. identity column strategy) that a
            // SQLite-built model won't have. EF treats that annotation diff as a pending
            // model change; it's a false positive here since the tables it produces are
            // schema-equivalent for SQLite's purposes, so the warning is suppressed.
            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseSqlite($"DataSource={_dbPath}");
                options.UseInternalServiceProvider(
                    new ServiceCollection().AddEntityFrameworkSqlite().BuildServiceProvider());
                options.ConfigureWarnings(w =>
                    w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
            });
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
