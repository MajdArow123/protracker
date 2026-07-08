using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IPublicProfileService
{
    Task<PublicProfileSettingsDto> GetSettingsAsync(ClaimsPrincipal user);
    Task<PublicProfileSettingsDto> UpdateSettingsAsync(ClaimsPrincipal user, UpdatePublicProfileDto dto);
    Task<PublicProfileDto> GetPublicAsync(string slug);
}

public class PublicProfileService : IPublicProfileService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public PublicProfileService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<PublicProfileSettingsDto> GetSettingsAsync(ClaimsPrincipal user)
    {
        var profile = await GetOrCreateAsync(user);
        return ToSettingsDto(profile);
    }

    public async Task<PublicProfileSettingsDto> UpdateSettingsAsync(ClaimsPrincipal user, UpdatePublicProfileDto dto)
    {
        var profile = await GetOrCreateAsync(user);

        var name = dto.DisplayName?.Trim();
        if (!string.IsNullOrEmpty(name)) profile.DisplayName = name;
        profile.Bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();
        profile.IsPublic = dto.IsPublic;
        profile.ShowAssessments = dto.ShowAssessments;
        profile.ShowGoals = dto.ShowGoals;
        profile.ShowJournal = dto.ShowJournal;
        profile.ShowMatchHistory = dto.ShowMatchHistory;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return ToSettingsDto(profile);
    }

    public async Task<PublicProfileDto> GetPublicAsync(string slug)
    {
        var normalized = (slug ?? "").Trim().ToLowerInvariant();
        var profile = await _context.PublicProfiles.FirstOrDefaultAsync(p => p.Slug == normalized);
        // A missing OR private profile both 404 — never reveal that a private profile exists.
        if (profile == null || !profile.IsPublic)
            throw new NotFoundApiException("This profile is not available.");

        var player = await _context.Players
            .Include(p => p.Sport)
            .Include(p => p.Position)
            .FirstOrDefaultAsync(p => p.Id == profile.PlayerId)
            ?? throw new NotFoundApiException("This profile is not available.");

        var dto = new PublicProfileDto
        {
            Slug = profile.Slug,
            DisplayName = string.IsNullOrWhiteSpace(profile.DisplayName) ? player.FullName : profile.DisplayName,
            Sport = player.Sport?.Name ?? "",
            Position = player.Position?.Name ?? "",
            ProfileImageUrl = player.ProfileImageUrl,
            Bio = profile.Bio,
            ShowAssessments = profile.ShowAssessments,
            ShowGoals = profile.ShowGoals,
            ShowJournal = profile.ShowJournal,
            ShowMatchHistory = profile.ShowMatchHistory,
        };

        // Assessment count + latest average always drive the header stats.
        var latest = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == player.Id)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();
        dto.AssessmentCount = await _context.PlayerAssessments.CountAsync(a => a.PlayerId == player.Id);

        if (latest != null && latest.StatScores.Count > 0)
        {
            dto.LatestAvgScore = Math.Round((double)latest.StatScores.Average(s => s.Score), 1);
            if (profile.ShowAssessments)
            {
                dto.Skills = latest.StatScores
                    .OrderBy(s => s.SportStatCategoryId)
                    .Select(s => new PublicRadarPointDto { Category = s.SportStatCategory.Name, Value = (double)s.Score })
                    .ToList();
            }
        }

        if (profile.ShowGoals)
        {
            var goals = await _context.PersonalGoals
                .Where(g => g.PlayerId == player.Id && !g.IsPrivate && g.Status != GoalStatus.Abandoned)
                .ToListAsync();
            dto.Goals = goals
                .OrderBy(g => g.Status == GoalStatus.Achieved)
                .ThenBy(g => g.Priority)
                .ThenByDescending(g => g.CreatedAt)
                .Take(6)
                .Select(g => new PublicGoalDto
                {
                    Title = g.Title,
                    Category = g.Category.ToString(),
                    Status = g.Status.ToString(),
                    ProgressPercent = ProgressPercent(g),
                    TargetValue = g.TargetValue,
                    CurrentValue = g.CurrentValue,
                    Unit = g.Unit,
                })
                .ToList();
        }

        if (profile.ShowJournal)
        {
            var entries = await _context.JournalEntries
                .Where(e => e.PlayerId == player.Id && !e.IsPrivate)
                .OrderByDescending(e => e.EntryDate)
                .Take(5)
                .ToListAsync();
            dto.Journal = entries.Select(e => new PublicJournalDto
            {
                EntryDate = e.EntryDate,
                Mood = e.Mood.ToString(),
                Title = string.IsNullOrWhiteSpace(e.Title) ? $"{e.Mood} day" : e.Title!,
                Excerpt = Excerpt(e.Content, 160),
            }).ToList();
        }

        if (profile.ShowMatchHistory)
        {
            var ratings = await _context.PlayerMatchRatings
                .Include(r => r.MatchResult)
                .Where(r => r.PlayerId == player.Id && r.MatchResult != null)
                .OrderByDescending(r => r.MatchResult.MatchDate)
                .Take(10)
                .ToListAsync();
            dto.Matches = ratings.Select(r =>
            {
                var m = r.MatchResult;
                var our = m.IsHome ? m.HomeScore : m.AwayScore;
                var opp = m.IsHome ? m.AwayScore : m.HomeScore;
                return new PublicMatchDto
                {
                    MatchDate = m.MatchDate,
                    OpponentName = m.OpponentName,
                    OurScore = our,
                    OpponentScore = opp,
                    Result = our > opp ? "Win" : our < opp ? "Loss" : "Draw",
                    Rating = r.Rating,
                };
            }).ToList();
        }

        return dto;
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<PublicProfile> GetOrCreateAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var profile = await _context.PublicProfiles.FirstOrDefaultAsync(p => p.PlayerId == player.Id);
        if (profile != null) return profile;

        await _context.Entry(player).Reference(p => p.Sport).LoadAsync();
        profile = new PublicProfile
        {
            PlayerId = player.Id,
            UserId = player.UserId,
            DisplayName = player.FullName,
            Slug = await UniqueSlugAsync(player.FullName, player.Sport?.Name),
            IsPublic = false,
            CreatedAt = DateTime.UtcNow,
        };
        _context.PublicProfiles.Add(profile);
        await _context.SaveChangesAsync();
        return profile;
    }

    private async Task<string> UniqueSlugAsync(string name, string? sport)
    {
        var baseSlug = Slugify($"{name} {sport}".Trim());
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "athlete";
        var slug = baseSlug;
        var n = 2;
        while (await _context.PublicProfiles.AnyAsync(p => p.Slug == slug))
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

    private static double? ProgressPercent(PersonalGoal g)
    {
        if (g.Status == GoalStatus.Achieved) return 100;
        if (g.TargetValue is not decimal target || target == 0 || g.CurrentValue is not decimal current) return null;
        return Math.Round(Math.Clamp((double)(current / target) * 100.0, 0, 100), 0);
    }

    private static string Excerpt(string content, int max)
    {
        if (string.IsNullOrEmpty(content)) return "";
        var s = content.Trim();
        return s.Length <= max ? s : s[..max].TrimEnd() + "…";
    }

    private static PublicProfileSettingsDto ToSettingsDto(PublicProfile p) => new()
    {
        Slug = p.Slug,
        DisplayName = p.DisplayName,
        Bio = p.Bio,
        IsPublic = p.IsPublic,
        ShowAssessments = p.ShowAssessments,
        ShowGoals = p.ShowGoals,
        ShowJournal = p.ShowJournal,
        ShowMatchHistory = p.ShowMatchHistory,
    };
}
