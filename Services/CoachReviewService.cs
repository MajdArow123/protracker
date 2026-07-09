using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ICoachReviewService
{
    Task<CoachReviewsResponseDto> GetForCoachAsync(ClaimsPrincipal? user, string slug);
    Task<CoachReviewDto> SubmitAsync(ClaimsPrincipal user, string slug, SubmitCoachReviewDto dto);
    Task<CoachReviewDto> RespondAsync(ClaimsPrincipal user, int id, string? response);
    Task DeleteAsync(ClaimsPrincipal user, int id);

    // (avgRating, reviewCount) for a coach — used to enrich marketplace/profile responses.
    Task<Dictionary<string, (double? Avg, int Count)>> GetRatingsAsync(IEnumerable<string> coachUserIds);
}

public class CoachReviewService : ICoachReviewService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public CoachReviewService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<CoachReviewsResponseDto> GetForCoachAsync(ClaimsPrincipal? user, string slug)
    {
        var normalized = (slug ?? "").Trim().ToLowerInvariant();
        var profile = await _context.CoachPublicProfiles.FirstOrDefaultAsync(p => p.Slug == normalized);
        if (profile == null || !profile.IsPublic)
            throw new NotFoundApiException("This coach profile is not available.");

        var callerId = user?.Identity?.IsAuthenticated == true ? user.FindFirstValue(ClaimTypes.NameIdentifier) : null;

        var reviews = await _context.CoachReviews
            .Where(r => r.CoachUserId == profile.CoachUserId && r.IsPublic)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var dist = new Dictionary<int, int> { { 1, 0 }, { 2, 0 }, { 3, 0 }, { 4, 0 }, { 5, 0 } };
        foreach (var r in reviews)
            if (dist.ContainsKey(r.Rating)) dist[r.Rating]++;

        return new CoachReviewsResponseDto
        {
            AverageRating = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : null,
            ReviewCount = reviews.Count,
            Distribution = dist,
            Reviews = reviews.Select(r => ToDto(r, callerId)).ToList(),
            HasReviewed = callerId != null && reviews.Any(r => r.ReviewerUserId == callerId),
            IsOwner = callerId != null && callerId == profile.CoachUserId,
        };
    }

    public async Task<CoachReviewDto> SubmitAsync(ClaimsPrincipal user, string slug, SubmitCoachReviewDto dto)
    {
        var normalized = (slug ?? "").Trim().ToLowerInvariant();
        var profile = await _context.CoachPublicProfiles.FirstOrDefaultAsync(p => p.Slug == normalized);
        if (profile == null || !profile.IsPublic)
            throw new NotFoundApiException("This coach profile is not available.");

        if (dto.Rating is < 1 or > 5)
            throw new ValidationApiException("Rating must be between 1 and 5.");

        var reviewerId = _access.RequireUserId(user);
        if (reviewerId == profile.CoachUserId)
            throw new ValidationApiException("You can't review yourself.");

        if (await _context.CoachReviews.AnyAsync(r => r.CoachUserId == profile.CoachUserId && r.ReviewerUserId == reviewerId))
            throw new ValidationApiException("You've already reviewed this coach.");

        var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == reviewerId);

        // Verified when the reviewer currently has a player on one of the coach's teams.
        var coachTeamIds = await _context.CoachTeamScopes
            .Where(s => s.CoachId == profile.CoachUserId).Select(s => s.TeamId).ToListAsync();
        var isVerified = player?.TeamId != null && coachTeamIds.Contains(player.TeamId.Value);

        var sportId = dto.Sport ?? player?.SportId;
        var sportName = sportId is int sid
            ? await _context.Sports.Where(s => s.Id == sid).Select(s => s.Name).FirstOrDefaultAsync()
            : null;
        var reviewerUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == reviewerId);

        var review = new CoachReview
        {
            CoachUserId = profile.CoachUserId,
            ReviewerUserId = reviewerId,
            ReviewerName = !string.IsNullOrWhiteSpace(player?.FullName) ? player!.FullName : (reviewerUser?.DisplayName ?? "Athlete"),
            Rating = dto.Rating,
            Title = Clean(dto.Title, 100),
            Content = Clean(dto.Content, 1000),
            SportId = sportId,
            SportName = sportName,
            IsVerified = isVerified,
            IsPublic = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _context.CoachReviews.Add(review);
        await _context.SaveChangesAsync();
        return ToDto(review, reviewerId);
    }

    public async Task<CoachReviewDto> RespondAsync(ClaimsPrincipal user, int id, string? response)
    {
        var coachId = _access.RequireUserId(user);
        var review = await _context.CoachReviews.FirstOrDefaultAsync(r => r.Id == id)
            ?? throw new NotFoundApiException("Review not found.");
        if (review.CoachUserId != coachId && !user.IsInRole("Admin"))
            throw new ForbiddenApiException("You can only respond to reviews on your own profile.");

        review.CoachResponse = Clean(response, 1000);
        review.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(review, coachId);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var callerId = _access.RequireUserId(user);
        var review = await _context.CoachReviews.FirstOrDefaultAsync(r => r.Id == id)
            ?? throw new NotFoundApiException("Review not found.");
        // A reviewer may delete their own review; admins may delete any.
        if (review.ReviewerUserId != callerId && !user.IsInRole("Admin"))
            throw new ForbiddenApiException("You can only delete your own review.");
        _context.CoachReviews.Remove(review);
        await _context.SaveChangesAsync();
    }

    public async Task<Dictionary<string, (double? Avg, int Count)>> GetRatingsAsync(IEnumerable<string> coachUserIds)
    {
        var ids = coachUserIds.Distinct().ToList();
        if (ids.Count == 0) return new();
        var rows = await _context.CoachReviews
            .Where(r => ids.Contains(r.CoachUserId) && r.IsPublic)
            .Select(r => new { r.CoachUserId, r.Rating })
            .ToListAsync();
        return rows.GroupBy(r => r.CoachUserId)
            .ToDictionary(g => g.Key, g => ((double?)Math.Round(g.Average(x => x.Rating), 1), g.Count()));
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static string? Clean(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim();
        return t.Length > max ? t[..max] : t;
    }

    private static CoachReviewDto ToDto(CoachReview r, string? callerId) => new()
    {
        Id = r.Id,
        ReviewerName = string.IsNullOrWhiteSpace(r.ReviewerName) ? "Anonymous" : r.ReviewerName,
        Rating = r.Rating,
        Title = r.Title,
        Content = r.Content,
        SportId = r.SportId,
        SportName = r.SportName,
        IsVerified = r.IsVerified,
        CoachResponse = r.CoachResponse,
        CreatedAt = r.CreatedAt,
        IsMine = callerId != null && r.ReviewerUserId == callerId,
    };
}
