using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IJournalService
{
    Task<List<JournalEntryDto>> GetMineAsync(ClaimsPrincipal user, int days);
    Task<JournalEntryDto?> GetTodayAsync(ClaimsPrincipal user);
    Task<JournalEntryDto> UpsertTodayAsync(ClaimsPrincipal user, UpsertJournalEntryDto dto);
    Task<JournalEntryDto> UpdateAsync(ClaimsPrincipal user, int id, UpsertJournalEntryDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<List<JournalEntryDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int days);
}

public class JournalService : IJournalService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public JournalService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    private static DateTime Today() => DateTime.UtcNow.Date;

    public async Task<List<JournalEntryDto>> GetMineAsync(ClaimsPrincipal user, int days)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var since = Today().AddDays(-Math.Clamp(days, 1, 366) + 1);
        var entries = await _context.JournalEntries
            .Where(e => e.PlayerId == player.Id && e.EntryDate >= since)
            .OrderByDescending(e => e.EntryDate)
            .ToListAsync();
        return entries.Select(ToDto).ToList();
    }

    public async Task<JournalEntryDto?> GetTodayAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var today = Today();
        var entry = await _context.JournalEntries
            .FirstOrDefaultAsync(e => e.PlayerId == player.Id && e.EntryDate == today);
        return entry == null ? null : ToDto(entry);
    }

    public async Task<JournalEntryDto> UpsertTodayAsync(ClaimsPrincipal user, UpsertJournalEntryDto dto)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        Validate(dto);

        var today = Today();
        var entry = await _context.JournalEntries
            .FirstOrDefaultAsync(e => e.PlayerId == player.Id && e.EntryDate == today);

        if (entry == null)
        {
            entry = new JournalEntry
            {
                PlayerId = player.Id,
                UserId = player.UserId,
                EntryDate = today,
                CreatedAt = DateTime.UtcNow,
            };
            _context.JournalEntries.Add(entry);
        }
        else
        {
            entry.UpdatedAt = DateTime.UtcNow;
        }

        Apply(entry, dto);
        await _context.SaveChangesAsync();
        return ToDto(entry);
    }

    public async Task<JournalEntryDto> UpdateAsync(ClaimsPrincipal user, int id, UpsertJournalEntryDto dto)
    {
        var entry = await LoadOwnedAsync(user, id);
        Validate(dto);
        Apply(entry, dto);
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(entry);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var entry = await LoadOwnedAsync(user, id);
        _context.JournalEntries.Remove(entry);
        await _context.SaveChangesAsync();
    }

    public async Task<List<JournalEntryDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId, int days)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        // Whether the caller is the owning athlete (sees private) or a coach (non-private only).
        var seesPrivate = await IsOwnerAsync(user, playerId);

        var since = Today().AddDays(-Math.Clamp(days, 1, 366) + 1);
        var entries = await _context.JournalEntries
            .Where(e => e.PlayerId == playerId && e.EntryDate >= since && (seesPrivate || !e.IsPrivate))
            .OrderByDescending(e => e.EntryDate)
            .ToListAsync();
        return entries.Select(ToDto).ToList();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static bool IsSelfOwnedAthlete(ClaimsPrincipal user) =>
        user.IsInRole("Athlete") || user.IsInRole("SoloAthlete");

    private async Task<bool> IsOwnerAsync(ClaimsPrincipal user, int playerId)
    {
        if (user.IsInRole("Admin")) return true;
        if (!IsSelfOwnedAthlete(user)) return false;
        var userId = _access.RequireUserId(user);
        return await _context.Players.AnyAsync(p => p.Id == playerId && p.UserId == userId);
    }

    // An entry may only be edited/deleted by the athlete who owns it (never a coach).
    private async Task<JournalEntry> LoadOwnedAsync(ClaimsPrincipal user, int id)
    {
        var entry = await _context.JournalEntries.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new NotFoundApiException($"Journal entry {id} was not found.");
        var player = await _access.RequireOwnPlayerAsync(user);
        if (entry.PlayerId != player.Id)
            throw new ForbiddenApiException("You can only modify your own journal entries.");
        return entry;
    }

    private static void Validate(UpsertJournalEntryDto dto)
    {
        var errors = new List<string>();
        if (dto.EnergyLevel is < 1 or > 5) errors.Add("Energy level must be between 1 and 5.");
        if (dto.TrainingRating is < 1 or > 5) errors.Add("Training rating must be between 1 and 5.");
        if (string.IsNullOrWhiteSpace(dto.Content) && string.IsNullOrWhiteSpace(dto.KeyLearning) && string.IsNullOrWhiteSpace(dto.TomorrowFocus))
            errors.Add("Write something in your entry before saving.");
        if (errors.Count > 0) throw new ValidationApiException(errors);
    }

    private static void Apply(JournalEntry entry, UpsertJournalEntryDto dto)
    {
        entry.Title = Trim(dto.Title);
        entry.Content = dto.Content?.Trim() ?? "";
        entry.Mood = dto.Mood;
        entry.EnergyLevel = dto.EnergyLevel;
        entry.TrainingRating = dto.TrainingRating;
        entry.KeyLearning = Trim(dto.KeyLearning);
        entry.TomorrowFocus = Trim(dto.TomorrowFocus);
        entry.Tags = NormalizeTags(dto.Tags);
        entry.IsPrivate = dto.IsPrivate;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // Normalises comma-separated tags: trims, drops blanks, dedupes (case-insensitive).
    private static string? NormalizeTags(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags)) return null;
        var parts = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .GroupBy(t => t.ToLowerInvariant())
            .Select(g => g.First())
            .ToList();
        return parts.Count == 0 ? null : string.Join(",", parts);
    }

    private static JournalEntryDto ToDto(JournalEntry e) => new()
    {
        Id = e.Id,
        PlayerId = e.PlayerId,
        EntryDate = e.EntryDate,
        Title = e.Title,
        Content = e.Content,
        Mood = e.Mood,
        EnergyLevel = e.EnergyLevel,
        TrainingRating = e.TrainingRating,
        KeyLearning = e.KeyLearning,
        TomorrowFocus = e.TomorrowFocus,
        Tags = e.Tags,
        IsPrivate = e.IsPrivate,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt,
    };
}
