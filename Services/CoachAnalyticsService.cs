using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ICoachAnalyticsService
{
    // Records a profile view (deduped per hashed IP per day). Never throws.
    Task RecordViewAsync(string slug, string? source, string? ip, string? viewerUserId);
    Task<CoachAnalyticsDto> GetAnalyticsAsync(ClaimsPrincipal coach);
}

public class CoachAnalyticsService : ICoachAnalyticsService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly ICoachReviewService _reviews;

    public CoachAnalyticsService(ApplicationDbContext context, IAccessControlService access, ICoachReviewService reviews)
    {
        _context = context;
        _access = access;
        _reviews = reviews;
    }

    public async Task RecordViewAsync(string slug, string? source, string? ip, string? viewerUserId)
    {
        try
        {
            var normalized = (slug ?? "").Trim().ToLowerInvariant();
            var profile = await _context.CoachPublicProfiles.FirstOrDefaultAsync(p => p.Slug == normalized);
            if (profile == null || !profile.IsPublic) return;

            // Don't count the coach viewing their own profile.
            if (viewerUserId != null && viewerUserId == profile.CoachUserId) return;

            var ipHash = Hash(ip);
            var today = DateTime.UtcNow.Date;

            // Dedup: one view per coach per hashed IP per day.
            var already = await _context.CoachProfileViews.AnyAsync(v =>
                v.CoachUserId == profile.CoachUserId && v.ViewerIpHash == ipHash && v.ViewedAt >= today);
            if (already) return;

            _context.CoachProfileViews.Add(new CoachProfileView
            {
                CoachUserId = profile.CoachUserId,
                ViewedAt = DateTime.UtcNow,
                ViewerIpHash = ipHash,
                ViewerUserId = viewerUserId,
                Source = NormalizeSource(source),
            });
            await _context.SaveChangesAsync();
        }
        catch
        {
            // Analytics must never break the public profile response.
        }
    }

    public async Task<CoachAnalyticsDto> GetAnalyticsAsync(ClaimsPrincipal coach)
    {
        var userId = _access.RequireUserId(coach);
        var appUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        var profile = await _context.CoachPublicProfiles.FirstOrDefaultAsync(p => p.CoachUserId == userId);

        var now = DateTime.UtcNow;
        var weekAgo = now.AddDays(-7);
        var monthAgo = now.AddDays(-30);

        var views = await _context.CoachProfileViews
            .Where(v => v.CoachUserId == userId)
            .Select(v => new { v.ViewedAt, v.Source })
            .ToListAsync();

        var requests = await _context.CoachConnectionRequests
            .Where(r => r.CoachUserId == userId)
            .Select(r => r.Status)
            .ToListAsync();
        var accepted = requests.Count(s => s == ConnectionRequestStatus.Accepted);
        var declined = requests.Count(s => s == ConnectionRequestStatus.Declined);
        var pending = requests.Count(s => s == ConnectionRequestStatus.Pending);
        var responded = accepted + declined;

        var ratings = await _reviews.GetRatingsAsync(new[] { userId });
        var rating = ratings.TryGetValue(userId, out var rc) ? rc : (Avg: (double?)null, Count: 0);

        // 30-day daily trend (fill gaps with 0).
        var byDay = views.Where(v => v.ViewedAt >= monthAgo)
            .GroupBy(v => v.ViewedAt.Date)
            .ToDictionary(g => g.Key, g => g.Count());
        var trend = new List<ViewPointDto>();
        for (var i = 29; i >= 0; i--)
        {
            var day = now.Date.AddDays(-i);
            trend.Add(new ViewPointDto { Date = day.ToString("yyyy-MM-dd"), Count = byDay.TryGetValue(day, out var c) ? c : 0 });
        }

        var bySource = views.GroupBy(v => string.IsNullOrWhiteSpace(v.Source) ? "direct" : v.Source!)
            .ToDictionary(g => g.Key, g => g.Count());

        var (completeness, items) = ComputeCompleteness(profile, appUser?.ProfilePictureUrl);

        return new CoachAnalyticsDto
        {
            IsPublic = profile?.IsPublic ?? false,
            TotalViews = views.Count,
            ViewsThisWeek = views.Count(v => v.ViewedAt >= weekAgo),
            ViewsThisMonth = views.Count(v => v.ViewedAt >= monthAgo),
            TotalRequests = requests.Count,
            PendingRequests = pending,
            AcceptedRequests = accepted,
            AcceptanceRate = responded > 0 ? Math.Round(accepted / (double)responded * 100, 0) : 0,
            TotalReviews = rating.Count,
            AverageRating = rating.Avg,
            ProfileCompleteness = completeness,
            ViewsBySource = bySource,
            ViewsTrend = trend,
            CompletenessItems = items,
        };
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static (int Percent, List<CompletenessItemDto> Items) ComputeCompleteness(CoachPublicProfile? p, string? photoUrl)
    {
        var items = new List<CompletenessItemDto>
        {
            new() { Label = "Profile photo", Weight = 15, Done = !string.IsNullOrWhiteSpace(photoUrl) },
            new() { Label = "Bio", Weight = 20, Done = !string.IsNullOrWhiteSpace(p?.Bio) },
            new() { Label = "Primary sport", Weight = 10, Done = p?.SportId != null },
            new() { Label = "City / Country", Weight = 10, Done = !string.IsNullOrWhiteSpace(p?.City) || !string.IsNullOrWhiteSpace(p?.Country) },
            new() { Label = "Certifications", Weight = 10, Done = !string.IsNullOrWhiteSpace(p?.Certifications) },
            new() { Label = "Specialization", Weight = 10, Done = !string.IsNullOrWhiteSpace(p?.Specialization) },
            new() { Label = "Contact email", Weight = 10, Done = !string.IsNullOrWhiteSpace(p?.ContactEmail) },
            new() { Label = "Years coaching", Weight = 5, Done = p?.YearsCoaching != null },
            new() { Label = "Accepting athletes", Weight = 10, Done = p?.IsAcceptingAthletes ?? false },
        };
        var total = items.Sum(i => i.Weight);
        var earned = items.Where(i => i.Done).Sum(i => i.Weight);
        return (total > 0 ? (int)Math.Round(earned / (double)total * 100) : 0, items);
    }

    private static string NormalizeSource(string? source)
    {
        var s = (source ?? "").Trim().ToLowerInvariant();
        return s is "marketplace" or "landing" or "direct" ? s : "direct";
    }

    private static string? Hash(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return null;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(ip.Trim()));
        return Convert.ToHexString(bytes);
    }
}
