using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ICoachPublicProfileService
{
    Task<CoachPublicProfileSettingsDto> GetSettingsAsync(ClaimsPrincipal user);
    Task<CoachPublicProfileSettingsDto> UpdateSettingsAsync(ClaimsPrincipal user, UpdateCoachPublicProfileDto dto);
    Task<PagedResult<CoachMarketplaceItemDto>> ListAsync(CoachMarketplaceQuery query);
    Task<CoachPublicProfileDto> GetPublicAsync(string slug);
}

// Query params for the public marketplace listing.
public class CoachMarketplaceQuery
{
    public int? Sport { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public bool? Accepting { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
}

public class CoachPublicProfileService : ICoachPublicProfileService
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public CoachPublicProfileService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<CoachPublicProfileSettingsDto> GetSettingsAsync(ClaimsPrincipal user)
    {
        var (profile, appUser) = await GetOrCreateAsync(user);
        var stats = await ComputeStatsAsync(profile.CoachUserId);
        return await ToSettingsDtoAsync(profile, appUser, stats);
    }

    public async Task<CoachPublicProfileSettingsDto> UpdateSettingsAsync(ClaimsPrincipal user, UpdateCoachPublicProfileDto dto)
    {
        var (profile, appUser) = await GetOrCreateAsync(user);

        if (!string.IsNullOrWhiteSpace(dto.Bio) && dto.Bio.Trim().Length > 1000)
            throw new ValidationApiException("Bio must be 1000 characters or fewer.");
        if (dto.YearsCoaching is < 0 or > 80)
            throw new ValidationApiException("Years coaching must be between 0 and 80.");
        if (dto.SportId is int sid && !await _context.Sports.AnyAsync(s => s.Id == sid))
            throw new ValidationApiException("The selected sport does not exist.");
        if (!string.IsNullOrWhiteSpace(dto.ContactEmail) && !dto.ContactEmail.Contains('@'))
            throw new ValidationApiException("Contact email is not valid.");

        profile.Bio = Clean(dto.Bio, 1000);
        profile.SportId = dto.SportId;
        profile.City = Clean(dto.City, 100);
        profile.Country = Clean(dto.Country, 100);
        profile.YearsCoaching = dto.YearsCoaching;
        profile.Certifications = Clean(dto.Certifications, 500);
        profile.Specialization = Clean(dto.Specialization, 200);
        profile.IsAcceptingAthletes = dto.IsAcceptingAthletes;
        profile.ContactEmail = Clean(dto.ContactEmail, 200)?.ToLowerInvariant();
        profile.IsPublic = dto.IsPublic;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        var stats = await ComputeStatsAsync(profile.CoachUserId);
        return await ToSettingsDtoAsync(profile, appUser, stats);
    }

    public async Task<PagedResult<CoachMarketplaceItemDto>> ListAsync(CoachMarketplaceQuery query)
    {
        var q = _context.CoachPublicProfiles.Include(p => p.Sport).Where(p => p.IsPublic);

        if (query.Sport is int sport) q = q.Where(p => p.SportId == sport);
        if (!string.IsNullOrWhiteSpace(query.City))
        {
            var city = query.City.Trim().ToLower();
            q = q.Where(p => p.City != null && p.City.ToLower().Contains(city));
        }
        if (!string.IsNullOrWhiteSpace(query.Country))
        {
            var country = query.Country.Trim().ToLower();
            q = q.Where(p => p.Country != null && p.Country.ToLower().Contains(country));
        }
        if (query.Accepting == true) q = q.Where(p => p.IsAcceptingAthletes);

        var profiles = await q.ToListAsync();

        // Join to ApplicationUser for name/photo, then apply the name/specialization search in
        // memory (names live on the Identity user, not the profile row).
        var userIds = profiles.Select(p => p.CoachUserId).ToList();
        var users = await _context.Users.Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u);

        var search = query.Search?.Trim().ToLowerInvariant();
        var items = new List<CoachMarketplaceItemDto>();
        foreach (var p in profiles)
        {
            users.TryGetValue(p.CoachUserId, out var u);
            var name = u?.DisplayName ?? "";
            if (!string.IsNullOrEmpty(search) &&
                !name.ToLowerInvariant().Contains(search) &&
                !(p.Specialization ?? "").ToLowerInvariant().Contains(search))
                continue;

            var stats = await ComputeStatsAsync(p.CoachUserId);
            items.Add(new CoachMarketplaceItemDto
            {
                Slug = p.Slug,
                DisplayName = name,
                ProfilePictureUrl = u?.ProfilePictureUrl,
                SportId = p.SportId,
                SportName = p.Sport?.Name,
                City = p.City,
                Country = p.Country,
                YearsCoaching = p.YearsCoaching,
                Specialization = p.Specialization,
                IsAcceptingAthletes = p.IsAcceptingAthletes,
                TeamCount = stats.TeamCount,
                PlayerCount = stats.PlayerCount,
            });
        }

        // Accepting-athletes first, then most experienced, then name.
        var ordered = items
            .OrderByDescending(i => i.IsAcceptingAthletes)
            .ThenByDescending(i => i.YearsCoaching ?? 0)
            .ThenBy(i => i.DisplayName)
            .ToList();

        var page = Math.Max(1, query.Page);
        var total = ordered.Count;
        var pageItems = ordered.Skip((page - 1) * PageSize).Take(PageSize).ToList();

        return new PagedResult<CoachMarketplaceItemDto>
        {
            Items = pageItems,
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)PageSize),
        };
    }

    public async Task<CoachPublicProfileDto> GetPublicAsync(string slug)
    {
        var normalized = (slug ?? "").Trim().ToLowerInvariant();
        var profile = await _context.CoachPublicProfiles.Include(p => p.Sport)
            .FirstOrDefaultAsync(p => p.Slug == normalized);
        // A missing OR non-public profile both 404 — never reveal that a private profile exists.
        if (profile == null || !profile.IsPublic)
            throw new NotFoundApiException("This coach profile is not available.");

        var appUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == profile.CoachUserId)
            ?? throw new NotFoundApiException("This coach profile is not available.");

        var stats = await ComputeStatsAsync(profile.CoachUserId);

        return new CoachPublicProfileDto
        {
            Slug = profile.Slug,
            DisplayName = appUser.DisplayName,
            ProfilePictureUrl = appUser.ProfilePictureUrl,
            SportId = profile.SportId,
            SportName = profile.Sport?.Name,
            Bio = profile.Bio,
            City = profile.City,
            Country = profile.Country,
            YearsCoaching = profile.YearsCoaching,
            Certifications = profile.Certifications,
            Specialization = profile.Specialization,
            IsAcceptingAthletes = profile.IsAcceptingAthletes,
            ContactEmail = profile.ContactEmail,
            TeamCount = stats.TeamCount,
            PlayerCount = stats.PlayerCount,
            AverageTeamScore = stats.AverageTeamScore,
        };
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private record CoachStats(int TeamCount, int PlayerCount, double? AverageTeamScore);

    // TeamCount / PlayerCount across the coach's teams; AverageTeamScore = mean of each
    // player's latest-assessment average.
    private async Task<CoachStats> ComputeStatsAsync(string coachUserId)
    {
        var teamIds = await _context.CoachTeamScopes
            .Where(s => s.CoachId == coachUserId)
            .Select(s => s.TeamId)
            .Distinct()
            .ToListAsync();

        if (teamIds.Count == 0) return new CoachStats(0, 0, null);

        var players = await _context.Players
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value))
            .Select(p => p.Id)
            .ToListAsync();

        double? avg = null;
        if (players.Count > 0)
        {
            // Each player's latest assessment average, then the mean across players.
            var perPlayer = new List<double>();
            var assessments = await _context.PlayerAssessments
                .Include(a => a.StatScores)
                .Where(a => players.Contains(a.PlayerId))
                .ToListAsync();
            foreach (var g in assessments.GroupBy(a => a.PlayerId))
            {
                var latest = g.OrderByDescending(a => a.DateRecorded).First();
                if (latest.StatScores.Count > 0)
                    perPlayer.Add((double)latest.StatScores.Average(s => s.Score));
            }
            if (perPlayer.Count > 0) avg = Math.Round(perPlayer.Average(), 1);
        }

        return new CoachStats(teamIds.Count, players.Count, avg);
    }

    private async Task<(CoachPublicProfile Profile, ApplicationUser User)> GetOrCreateAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var appUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new NotFoundApiException("Account not found.");

        var profile = await _context.CoachPublicProfiles.Include(p => p.Sport)
            .FirstOrDefaultAsync(p => p.CoachUserId == userId);
        if (profile != null) return (profile, appUser);

        // Default the primary sport to the coach's most common team sport.
        var primarySport = await _context.CoachTeamScopes
            .Where(s => s.CoachId == userId)
            .Select(s => s.Team.SportId)
            .ToListAsync();
        int? sportId = primarySport.Count > 0
            ? primarySport.GroupBy(x => x).OrderByDescending(g => g.Count()).First().Key
            : null;

        var sportName = sportId is int sp
            ? (await _context.Sports.Where(s => s.Id == sp).Select(s => s.Name).FirstOrDefaultAsync())
            : null;

        profile = new CoachPublicProfile
        {
            CoachUserId = userId,
            Slug = await UniqueSlugAsync(appUser.DisplayName, sportName),
            Bio = string.IsNullOrWhiteSpace(appUser.Bio) ? null : appUser.Bio,
            SportId = sportId,
            Certifications = appUser.Certifications,
            Specialization = appUser.Specialization,
            IsAcceptingAthletes = true,
            IsPublic = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _context.CoachPublicProfiles.Add(profile);
        await _context.SaveChangesAsync();
        if (sportId != null) await _context.Entry(profile).Reference(p => p.Sport).LoadAsync();
        return (profile, appUser);
    }

    private async Task<string> UniqueSlugAsync(string name, string? sport)
    {
        var baseSlug = Slugify($"{name} {sport}".Trim());
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "coach";
        var slug = baseSlug;
        var n = 2;
        while (await _context.CoachPublicProfiles.AnyAsync(p => p.Slug == slug))
            slug = $"{baseSlug}-{n++}";
        return slug;
    }

    private static string Slugify(string input)
    {
        var sb = new StringBuilder();
        bool lastDash = false;
        foreach (var ch in input.ToLowerInvariant())
        {
            if (ch is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                sb.Append(ch);
                lastDash = false;
            }
            else if (!lastDash && sb.Length > 0)
            {
                sb.Append('-');
                lastDash = true;
            }
        }
        return sb.ToString().Trim('-');
    }

    private static string? Clean(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }

    private async Task<CoachPublicProfileSettingsDto> ToSettingsDtoAsync(CoachPublicProfile p, ApplicationUser u, CoachStats stats)
    {
        var sportName = p.Sport?.Name;
        if (sportName == null && p.SportId is int sid)
            sportName = await _context.Sports.Where(s => s.Id == sid).Select(s => s.Name).FirstOrDefaultAsync();

        return new CoachPublicProfileSettingsDto
        {
            Slug = p.Slug,
            DisplayName = u.DisplayName,
            ProfilePictureUrl = u.ProfilePictureUrl,
            Bio = p.Bio,
            SportId = p.SportId,
            SportName = sportName,
            City = p.City,
            Country = p.Country,
            YearsCoaching = p.YearsCoaching,
            Certifications = p.Certifications,
            Specialization = p.Specialization,
            IsAcceptingAthletes = p.IsAcceptingAthletes,
            ContactEmail = p.ContactEmail,
            IsPublic = p.IsPublic,
            TeamCount = stats.TeamCount,
            PlayerCount = stats.PlayerCount,
            AverageTeamScore = stats.AverageTeamScore,
        };
    }
}
