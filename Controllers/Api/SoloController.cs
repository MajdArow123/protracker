using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProTracker.Auth;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

// Endpoints owned by the solo-athlete experience: their solo profile, personal
// training sessions / matches, and the "connect to a coach" upgrade path.
[Route("api/solo")]
[Authorize(Roles = "SoloAthlete")]
public class SoloController : ApiControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthService _authService;
    private readonly IAccessControlService _access;
    private readonly IScheduledSessionService _sessions;
    private readonly IMatchService _matches;

    public SoloController(
        ApplicationDbContext context,
        IAuthService authService,
        IAccessControlService access,
        IScheduledSessionService sessions,
        IMatchService matches)
    {
        _context = context;
        _authService = authService;
        _access = access;
        _sessions = sessions;
        _matches = matches;
    }

    // Public: the sports + their positions, for the pre-auth solo registration wizard
    // (mirrors how join-code validation ships positions to the join wizard).
    [HttpGet("sports")]
    [AllowAnonymous]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("join-validate")]
    public async Task<ActionResult> GetSports()
    {
        var sports = await _context.Sports
            .OrderBy(s => s.Id)
            .Select(s => new SoloSportOptionDto
            {
                Id = s.Id,
                Name = s.Name,
                Positions = s.Positions
                    .OrderBy(p => p.Id)
                    .Select(p => new PositionOptionDto { Id = p.Id, Name = p.Name })
                    .ToList(),
            })
            .ToListAsync();
        return Success(sports);
    }

    // ─── Solo profile ────────────────────────────────────────────────────────

    [HttpGet("profile")]
    public async Task<ActionResult> GetProfile() => Success(await LoadProfileDtoAsync());

    [HttpPut("profile")]
    public async Task<ActionResult> UpdateProfile(UpdateSoloProfileRequest request)
    {
        var profile = await RequireSoloProfileAsync();

        if (request.SkillLevel != null)
        {
            if (!Enum.TryParse<SkillLevel>(request.SkillLevel, true, out var skill))
                throw new ValidationApiException("Invalid skill level.");
            profile.SkillLevel = skill;
        }
        if (request.TrainingFrequency != null)
        {
            if (!Enum.TryParse<TrainingFrequency>(request.TrainingFrequency, true, out var freq))
                throw new ValidationApiException("Invalid training frequency.");
            profile.TrainingFrequency = freq;
        }
        if (request.Goals != null)
        {
            profile.Goals = string.IsNullOrWhiteSpace(request.Goals) ? null : request.Goals.Trim();
            // Keep the player's goals (used in AI prompts) aligned with the solo profile.
            var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == profile.PlayerId);
            if (player != null) player.Goals = profile.Goals;
        }
        if (request.Motivation != null)
            profile.Motivation = string.IsNullOrWhiteSpace(request.Motivation) ? null : request.Motivation.Trim();

        await _context.SaveChangesAsync();
        return Success(await LoadProfileDtoAsync());
    }

    // ─── Personal training sessions ──────────────────────────────────────────

    [HttpGet("sessions")]
    public async Task<ActionResult> GetSessions() => Success(await _sessions.GetMySoloSessionsAsync(User));

    [HttpPost("sessions")]
    public async Task<ActionResult> CreateSession(CreateScheduledSessionDto dto) =>
        Created(await _sessions.CreateForSelfAsync(User, dto));

    // ─── Personal matches ────────────────────────────────────────────────────

    [HttpGet("matches")]
    public async Task<ActionResult> GetMatches() => Success(await _matches.GetMySoloMatchesAsync(User));

    [HttpPost("matches")]
    public async Task<ActionResult> CreateMatch(CreateMatchResultDto dto) =>
        Created(await _matches.CreateForSelfAsync(User, dto));

    // ─── Connect to a coach ──────────────────────────────────────────────────

    // Converts the solo account into a coach-managed Athlete via a team join code.
    // All existing data stays on the player record. Returns fresh tokens (role changed).
    [HttpPost("connect-coach")]
    public async Task<ActionResult> ConnectCoach(ConnectCoachRequest request)
    {
        var result = await _authService.ConnectCoachAsync(User, request);
        WriteAuthCookies(result.AccessToken, result.RefreshToken);
        return Success(result);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async Task<SoloProfile> RequireSoloProfileAsync()
    {
        var userId = _access.RequireUserId(User);
        return await _context.SoloProfiles.FirstOrDefaultAsync(s => s.UserId == userId)
            ?? throw new NotFoundApiException("No solo profile is linked to your account.");
    }

    private async Task<SoloProfileDto> LoadProfileDtoAsync()
    {
        var userId = _access.RequireUserId(User);
        var profile = await _context.SoloProfiles
            .Include(s => s.Sport)
            .FirstOrDefaultAsync(s => s.UserId == userId)
            ?? throw new NotFoundApiException("No solo profile is linked to your account.");

        return new SoloProfileDto
        {
            Id = profile.Id,
            PlayerId = profile.PlayerId,
            SportId = profile.SportId,
            SportName = profile.Sport?.Name ?? "",
            SkillLevel = profile.SkillLevel.ToString(),
            TrainingFrequency = profile.TrainingFrequency.ToString(),
            Goals = profile.Goals,
            Motivation = profile.Motivation,
            CreatedAt = profile.CreatedAt,
        };
    }

    private void WriteAuthCookies(string accessToken, string refreshToken)
    {
        var isDev = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = !isDev,
            SameSite = isDev ? SameSiteMode.Strict : SameSiteMode.None,
            Path = "/"
        };

        Response.Cookies.Append(JwtSettings.AccessTokenCookieName, accessToken, cookieOptions);
        Response.Cookies.Append(JwtSettings.RefreshTokenCookieName, refreshToken, cookieOptions);
    }
}
