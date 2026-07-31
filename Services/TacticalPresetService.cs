using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ITacticalPresetService
{
    Task<List<TacticalPresetDto>> GetMineAsync(ClaimsPrincipal user, int? sportId);
    Task<TacticalPresetDto> CreateAsync(ClaimsPrincipal user, SaveTacticalPresetDto dto);
    Task<TacticalPresetDto> UpdateAsync(ClaimsPrincipal user, int id, SaveTacticalPresetDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

// Coach-owned tactical presets (Phase 6) — the AssessmentTemplateService
// pattern: owner-scoped list, LoadOwnedAsync 404/403 with Admin bypass.
// Uniqueness (CoachId, SportId, normalized Name) + the per-coach cap are
// service-enforced (codebase convention; no filtered index).
public class TacticalPresetService : ITacticalPresetService
{
    private const int MaxPresetsPerCoach = 20;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public TacticalPresetService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<TacticalPresetDto>> GetMineAsync(ClaimsPrincipal user, int? sportId)
    {
        var userId = _access.RequireUserId(user);
        var presets = await _context.TacticalPresets
            .Where(p => p.CoachId == userId && (sportId == null || p.SportId == sportId))
            .OrderBy(p => p.Name)
            .ToListAsync();
        return presets.Select(ToDto).ToList();
    }

    public async Task<TacticalPresetDto> CreateAsync(ClaimsPrincipal user, SaveTacticalPresetDto dto)
    {
        var userId = _access.RequireUserId(user);
        var name = dto.Name.Trim();

        var sportOk = await _context.Sports.AnyAsync(s => s.Id == dto.SportId);
        if (!sportOk) throw new ValidationApiException("The sport does not exist.");

        var count = await _context.TacticalPresets.CountAsync(p => p.CoachId == userId);
        if (count >= MaxPresetsPerCoach)
            throw new ValidationApiException($"You can have at most {MaxPresetsPerCoach} tactical presets.");
        await EnsureNameFreeAsync(userId, dto.SportId, name, excludeId: null);

        var preset = new TacticalPreset
        {
            CoachId = userId,
            SportId = dto.SportId,
            Name = name,
            Formation = NullIfBlank(dto.Formation),
            SettingsJson = SerializeSettings(dto),
        };
        _context.TacticalPresets.Add(preset);
        await _context.SaveChangesAsync();
        return ToDto(preset);
    }

    public async Task<TacticalPresetDto> UpdateAsync(ClaimsPrincipal user, int id, SaveTacticalPresetDto dto)
    {
        var preset = await LoadOwnedAsync(user, id);
        var name = dto.Name.Trim();
        // Sport is fixed after creation — roles/formation are sport-specific.
        if (dto.SportId != preset.SportId)
            throw new ValidationApiException("A preset's sport cannot be changed.");
        await EnsureNameFreeAsync(preset.CoachId, preset.SportId, name, excludeId: preset.Id);

        preset.Name = name;
        preset.Formation = NullIfBlank(dto.Formation);
        preset.SettingsJson = SerializeSettings(dto);
        preset.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(preset);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var preset = await LoadOwnedAsync(user, id);
        _context.TacticalPresets.Remove(preset);
        await _context.SaveChangesAsync();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<TacticalPreset> LoadOwnedAsync(ClaimsPrincipal user, int id)
    {
        var preset = await _context.TacticalPresets.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Preset {id} was not found.");
        if (!user.IsInRole("Admin"))
        {
            var userId = _access.RequireUserId(user);
            if (preset.CoachId != userId)
                throw new ForbiddenApiException("You can only manage presets you created.");
        }
        return preset;
    }

    private async Task EnsureNameFreeAsync(string coachId, int sportId, string name, int? excludeId)
    {
        var lower = name.ToLowerInvariant();
        var taken = await _context.TacticalPresets.AnyAsync(p =>
            p.CoachId == coachId && p.SportId == sportId && p.Id != excludeId && p.Name.ToLower() == lower);
        if (taken) throw new ValidationApiException("You already have a preset with this name for this sport.");
    }

    private sealed class PresetSettings
    {
        public Dictionary<string, string> Roles { get; set; } = new();
        public List<string> Labels { get; set; } = new();
    }

    private static string SerializeSettings(SaveTacticalPresetDto dto) =>
        JsonSerializer.Serialize(new PresetSettings
        {
            Roles = (dto.Roles ?? new Dictionary<string, string>())
                .Where(r => !string.IsNullOrWhiteSpace(r.Value))
                .ToDictionary(r => r.Key.Trim(), r => r.Value.Trim()),
            Labels = (dto.Labels ?? new List<string>()).Select(l => l.Trim()).Where(l => l.Length > 0).ToList(),
        }, JsonOpts);

    private static TacticalPresetDto ToDto(TacticalPreset p)
    {
        PresetSettings settings;
        try
        {
            settings = JsonSerializer.Deserialize<PresetSettings>(p.SettingsJson, JsonOpts) ?? new PresetSettings();
        }
        catch (JsonException)
        {
            settings = new PresetSettings();
        }
        return new TacticalPresetDto
        {
            Id = p.Id,
            SportId = p.SportId,
            Name = p.Name,
            Formation = p.Formation,
            Roles = settings.Roles,
            Labels = settings.Labels,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
        };
    }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
