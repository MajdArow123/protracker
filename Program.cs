using System.Security.Claims;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ProTracker.Auth;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Middleware;
using ProTracker.Models;
using ProTracker.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Use Railway's PORT environment variable
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Add services to the container.
// Railway injects Postgres connection info as a "postgres://user:pass@host:port/db" URI in
// DATABASE_URL. Npgsql needs the keyword=value format, so convert when present; otherwise
// fall back to the "DefaultConnection" config value (used for local development).
var connectionString = ResolveConnectionString(builder.Configuration);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddDatabaseDeveloperPageExceptionFilter();

builder.Services.AddDefaultIdentity<ApplicationUser>(options =>
    {
        options.SignIn.RequireConfirmedAccount = false;
        // Registration- and reset-consistent rules: min 8 chars, one uppercase, one digit.
        // (Matches the frontend password-strength indicator.)
        options.Password.RequiredLength = 8;
        options.Password.RequireUppercase = true;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = false;
        options.Password.RequireNonAlphanumeric = false;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Identity/Account/Login";
    options.LogoutPath = "/Identity/Account/Logout";
    options.AccessDeniedPath = "/Identity/Account/AccessDenied";
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// --- Phase 3: Web API additions (alongside the existing MVC pipeline above) ---

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();

// Fail closed before anything can issue a token: production must never fall through to the
// placeholder key committed in appsettings.json (it is public, so tokens signed with it are
// forgeable). Dev/test keep the convenience default.
JwtSettings.EnsureProductionSigningKey(jwtSettings.SigningKey, builder.Environment.IsProduction());

// Adds a "Bearer" scheme alongside Identity's existing cookie scheme (which stays the
// default for the MVC pages). API controllers opt into this scheme explicitly via
// [Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)].
builder.Services.AddAuthentication()
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.NameIdentifier
        };

        // Read the access token from the HttpOnly cookie (REST) or, for the SignalR hub, from the
        // `access_token` query string — the WebSocket handshake can't set an Authorization header,
        // so the JS client passes the token this way via accessTokenFactory.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var path = context.HttpContext.Request.Path;
                var queryToken = context.Request.Query["access_token"];
                if (path.StartsWithSegments("/hubs") && !string.IsNullOrEmpty(queryToken))
                    context.Token = queryToken;
                else if (context.Request.Cookies.TryGetValue(JwtSettings.AccessTokenCookieName, out var token))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

var reactOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactClient", policy => policy
        .SetIsOriginAllowed(origin =>
        {
            if (reactOrigins.Contains(origin)) return true;
            // Allow all Vercel preview deployments for this project
            var uri = new Uri(origin);
            return uri.Host.EndsWith("-pro-tracker.vercel.app") || uri.Host == "protracker-iota.vercel.app";
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage)
            .ToList();

        return new BadRequestObjectResult(new ApiErrorResponse
        {
            Message = "One or more validation errors occurred.",
            Errors = errors
        });
    };
});

builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddFluentValidationAutoValidation();

// Per-IP rate limit for the public join-code endpoints (validate + register) so 8-char
// codes can't be brute-forced. Authenticated endpoints are unaffected.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("join-validate", context =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
            }));

    // Public Vora meal-suggestion endpoint: every request spends an Anthropic call, so
    // this is far tighter than join-validate. Partitions by the first X-Forwarded-For
    // hop — behind Railway's proxy the socket IP is the proxy itself, which would
    // collapse all clients into one shared bucket. XFF is spoofable; accepted trade
    // for a free anonymous endpoint (max_tokens caps the per-call cost).
    options.AddPolicy("meal-suggestion", context =>
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        var clientIp = !string.IsNullOrWhiteSpace(forwarded)
            ? forwarded.Split(',')[0].Trim()
            : context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            clientIp,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromHours(1),
            });
    });
});

builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAccessControlService, AccessControlService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ISportService, SportService>();
builder.Services.AddScoped<ITeamService, TeamService>();
builder.Services.AddScoped<IPlayerService, PlayerService>();
builder.Services.AddScoped<IAssessmentService, AssessmentService>();
builder.Services.AddScoped<IStatScoreService, StatScoreService>();
builder.Services.AddScoped<IImprovementPlanService, ImprovementPlanService>();
builder.Services.AddScoped<INutritionGuidanceService, NutritionGuidanceService>();
builder.Services.AddScoped<INutritionProfileService, NutritionProfileService>();
builder.Services.AddScoped<IFoodAlternativesService, FoodAlternativesService>();
builder.Services.AddScoped<ITrainingSessionService, TrainingSessionService>();
builder.Services.AddScoped<IMatchPerformanceService, MatchPerformanceService>();
builder.Services.AddScoped<IInjuryService, InjuryService>();
builder.Services.AddScoped<IPlayerTaskService, PlayerTaskService>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddScoped<IScheduledSessionService, ScheduledSessionService>();
builder.Services.AddScoped<ICoachNoteService, CoachNoteService>();
builder.Services.AddScoped<ITeamAnnouncementService, TeamAnnouncementService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<IRecoveryPlanService, RecoveryPlanService>();
builder.Services.AddScoped<IWellbeingService, WellbeingService>();
builder.Services.AddScoped<IPersonalGoalService, PersonalGoalService>();
builder.Services.AddScoped<IJournalService, JournalService>();
builder.Services.AddScoped<IPublicProfileService, PublicProfileService>();
builder.Services.AddScoped<ICoachPublicProfileService, CoachPublicProfileService>();
builder.Services.AddScoped<ICoachConnectionService, CoachConnectionService>();
builder.Services.AddScoped<ICoachReviewService, CoachReviewService>();
builder.Services.AddScoped<ICoachAnalyticsService, CoachAnalyticsService>();
builder.Services.AddScoped<IDrillService, DrillService>();
builder.Services.AddScoped<IAssessmentTemplateService, AssessmentTemplateService>();
builder.Services.AddScoped<ITeamCoachService, TeamCoachService>();
builder.Services.AddScoped<ISessionFeedbackService, SessionFeedbackService>();
builder.Services.AddScoped<IAthleteNoteService, AthleteNoteService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<ISeasonRosterService, SeasonRosterService>();
// Phase 10 S2: registered but not yet consumed — the S3 create paths wire it in.
builder.Services.AddScoped<ISeasonResolver, SeasonResolver>();
builder.Services.AddScoped<ISeasonStamper, SeasonStamper>();
builder.Services.AddScoped<ISeasonBackfillService, SeasonBackfillService>();
builder.Services.AddScoped<IParentService, ParentService>();
builder.Services.AddScoped<IJoinCodeService, JoinCodeService>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddSingleton<IImageService, ImageService>();
builder.Services.AddSingleton<IPushService, PushService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IBillingService, BillingService>();
builder.Services.AddSignalR();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IWeeklyNutritionPlanService, WeeklyNutritionPlanService>();
builder.Services.AddScoped<ILeagueService, LeagueService>();
builder.Services.AddScoped<IEvidenceScoringEngine, EvidenceScoringEngine>();
builder.Services.AddScoped<IEvidenceService, EvidenceService>();
builder.Services.AddScoped<ILineupService, LineupService>();
builder.Services.AddScoped<ITacticalPresetService, TacticalPresetService>();
builder.Services.AddScoped<IBenchmarkService, BenchmarkService>();
builder.Services.AddScoped<IMealSuggestionService, MealSuggestionService>();
// AI domain services (Phase 9 split of the former AIController) — shared evidence
// context + one service per AI controller.
builder.Services.AddScoped<IAIEvidenceContextService, AIEvidenceContextService>();
builder.Services.AddScoped<IAIPlayerDevelopmentService, AIPlayerDevelopmentService>();
builder.Services.AddScoped<IAINutritionService, AINutritionService>();
builder.Services.AddScoped<IAIRecoveryService, AIRecoveryService>();
builder.Services.AddScoped<IAIInsightsService, AIInsightsService>();
// On-demand demo showcase seeding (token-gated endpoint; see DemoShowcaseSeeder).
builder.Services.AddScoped<ProTracker.Data.Showcase.DemoShowcaseSeeder>();

// AI service — reads API key from env var first, then appsettings
var anthropicKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
    ?? builder.Configuration["Anthropic:ApiKey"]
    ?? "";
builder.Services.AddHttpClient<IAIService, AIService>(client =>
{
    client.BaseAddress = new Uri("https://api.anthropic.com/");
    client.DefaultRequestHeaders.Add("x-api-key", anthropicKey);
    client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
    client.Timeout = TimeSpan.FromSeconds(300);
});

var app = builder.Build();

// Auto-apply migrations and seed roles on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in new[] { "Coach", "Athlete", "Admin", "Parent", "SoloAthlete" })
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    await ProTracker.Data.RecoveryTemplateSeeder.SeedAsync(db);
    await ProTracker.Data.MetricDefinitionSeeder.SeedAsync(db);
    await ProTracker.Data.BenchmarkProfileSeeder.SeedAsync(db);
    await ProTracker.Data.DrillSeeder.SeedAsync(db);
    await ProTracker.Data.FoodItemSeeder.SeedAsync(db);
    await ProTracker.Data.DemoDataSeeder.SeedAsync(scope.ServiceProvider);

    // Prune notifications older than 90 days (best-effort housekeeping).
    try
    {
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
        await notifications.DeleteOldAsync();
    }
    catch { /* non-fatal */ }
}

// Global error handling — wraps the entire pipeline so any unhandled exception (from MVC,
// the API controllers, or middleware below) comes back as the standard {success,message,errors} envelope.
app.UseMiddleware<ErrorHandlingMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseMigrationsEndPoint();
}
else
{
    app.UseHsts();
}

app.UseRouting();

app.UseRateLimiter();

app.UseCors("ReactClient");

app.UseAuthorization();
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/", () => Results.Json(new { message = "ProTracker API", version = "1.0", docs = "/api" }));

app.MapControllers();
app.MapHub<ProTracker.Hubs.ChatHub>("/hubs/chat");

app.Run();

static string ResolveConnectionString(IConfiguration config)
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    if (string.IsNullOrEmpty(databaseUrl))
    {
        return config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
    }

    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':', 2);
    var database = uri.AbsolutePath.TrimStart('/');

    return new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
        Database = database,
        SslMode = Npgsql.SslMode.Prefer,
    }.ConnectionString;
}

public partial class Program { }
