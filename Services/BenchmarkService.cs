using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// Benchmark calibration profiles: system defaults + coach-owned custom profiles, the
// team → profile assignment, and per-player benchmark resolution for the evidence UI.
public interface IBenchmarkService
{
    Task<List<BenchmarkProfileDto>> GetProfilesAsync(ClaimsPrincipal user, int sportId);
    Task<BenchmarkProfileDto> CreateAsync(ClaimsPrincipal user, CreateBenchmarkProfileDto dto);
    Task<BenchmarkProfileDto> UpdateAsync(ClaimsPrincipal user, int id, CreateBenchmarkProfileDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);

    Task<TeamBenchmarkProfileDto> GetTeamProfileAsync(ClaimsPrincipal user, int teamId);
    Task<TeamBenchmarkProfileDto> SetTeamProfileAsync(ClaimsPrincipal user, int teamId, SetTeamBenchmarkProfileDto dto);

    Task<PlayerBenchmarksDto> GetPlayerBenchmarksAsync(ClaimsPrincipal user, int playerId);
}

public class BenchmarkService : IBenchmarkService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public BenchmarkService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<BenchmarkProfileDto>> GetProfilesAsync(ClaimsPrincipal user, int sportId)
    {
        var userId = _access.RequireUserId(user);
        var profiles = await _context.BenchmarkProfiles
            .Include(p => p.Values).ThenInclude(v => v.MetricDefinition)
            .Where(p => p.SportId == sportId && (p.IsDefault || p.CoachId == userId))
            .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Id)
            .ToListAsync();
        return profiles.Select(p => ToDto(p, userId)).ToList();
    }

    public async Task<BenchmarkProfileDto> CreateAsync(ClaimsPrincipal user, CreateBenchmarkProfileDto dto)
    {
        var userId = _access.RequireUserId(user);
        ValidateMeta(dto);

        var profile = new BenchmarkProfile
        {
            CoachId = userId,
            SportId = dto.SportId,
            Name = dto.Name.Trim(),
            AgeGroupMin = dto.AgeGroupMin,
            AgeGroupMax = dto.AgeGroupMax,
            CompetitionLevel = ParseLevel(dto.CompetitionLevel),
            IsDefault = false,
        };

        profile.Values = await BuildValuesAsync(dto, userId);
        _context.BenchmarkProfiles.Add(profile);
        await _context.SaveChangesAsync();

        return ToDto(await ReloadAsync(profile.Id), userId);
    }

    public async Task<BenchmarkProfileDto> UpdateAsync(ClaimsPrincipal user, int id, CreateBenchmarkProfileDto dto)
    {
        var userId = _access.RequireUserId(user);
        var profile = await LoadOwnedAsync(id, userId);
        ValidateMeta(dto);

        profile.Name = dto.Name.Trim();
        profile.AgeGroupMin = dto.AgeGroupMin;
        profile.AgeGroupMax = dto.AgeGroupMax;
        profile.CompetitionLevel = ParseLevel(dto.CompetitionLevel);

        if (dto.Values is { Count: > 0 })
        {
            await ValidateValueMetricsAsync(profile.SportId, dto.Values);
            _context.BenchmarkValues.RemoveRange(profile.Values);
            profile.Values = dto.Values.Select(v => new BenchmarkValue
            {
                MetricDefinitionId = v.MetricDefinitionId,
                BenchmarkLow = v.BenchmarkLow,
                BenchmarkMid = v.BenchmarkMid,
                BenchmarkHigh = v.BenchmarkHigh,
                Notes = v.Notes,
            }).ToList();
        }

        await _context.SaveChangesAsync();
        return ToDto(await ReloadAsync(profile.Id), userId);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var userId = _access.RequireUserId(user);
        var profile = await LoadOwnedAsync(id, userId);
        _context.BenchmarkProfiles.Remove(profile); // teams using it SetNull back to defaults
        await _context.SaveChangesAsync();
    }

    public async Task<TeamBenchmarkProfileDto> GetTeamProfileAsync(ClaimsPrincipal user, int teamId)
    {
        await _access.EnsureCanAccessTeamAsync(user, teamId);
        var team = await _context.Teams
            .Include(t => t.BenchmarkProfile)
            .FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");
        return new TeamBenchmarkProfileDto
        {
            TeamId = teamId,
            BenchmarkProfileId = team.BenchmarkProfileId,
            ProfileName = team.BenchmarkProfile?.Name,
        };
    }

    public async Task<TeamBenchmarkProfileDto> SetTeamProfileAsync(ClaimsPrincipal user, int teamId, SetTeamBenchmarkProfileDto dto)
    {
        await _access.EnsureTeamPermissionAsync(user, teamId, p => p.CanManageTeam,
            "You don't have permission to change this team's benchmark profile.");
        var userId = _access.RequireUserId(user);
        var team = await _context.Teams.FirstOrDefaultAsync(t => t.Id == teamId)
            ?? throw new NotFoundApiException($"Team {teamId} was not found.");

        if (dto.BenchmarkProfileId is int profileId)
        {
            var profile = await _context.BenchmarkProfiles.FirstOrDefaultAsync(p => p.Id == profileId)
                ?? throw new NotFoundApiException($"Benchmark profile {profileId} was not found.");
            if (!profile.IsDefault && profile.CoachId != userId)
                throw new ForbiddenApiException("You can only use system profiles or your own.");
            if (profile.SportId != team.SportId)
                throw new ValidationApiException("This benchmark profile belongs to a different sport.");
            team.BenchmarkProfileId = profileId;
        }
        else
        {
            team.BenchmarkProfileId = null;
        }

        await _context.SaveChangesAsync();
        return await GetTeamProfileAsync(user, teamId);
    }

    // The benchmarks in force for one player: their team's profile values, keyed by
    // metric id. Team-less (solo) players get an empty map = definition defaults.
    public async Task<PlayerBenchmarksDto> GetPlayerBenchmarksAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var info = await _context.Players
            .Where(p => p.Id == playerId)
            .Select(p => new { ProfileId = p.Team != null ? p.Team.BenchmarkProfileId : null })
            .FirstOrDefaultAsync()
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        var dto = new PlayerBenchmarksDto { PlayerId = playerId, BenchmarkProfileId = info.ProfileId };
        if (info.ProfileId is not int profileId) return dto;

        var profile = await _context.BenchmarkProfiles
            .Include(p => p.Values).ThenInclude(v => v.MetricDefinition)
            .FirstOrDefaultAsync(p => p.Id == profileId);
        if (profile == null) return dto;

        dto.ProfileName = profile.Name;
        dto.Values = profile.Values.ToDictionary(v => v.MetricDefinitionId, ToValueDto);
        return dto;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private void ValidateMeta(CreateBenchmarkProfileDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ValidationApiException("Profile name is required.");
        if (dto.AgeGroupMin is int min && dto.AgeGroupMax is int max && min > max)
            throw new ValidationApiException("Minimum age cannot exceed maximum age.");
    }

    private static CompetitionLevel ParseLevel(string level) =>
        Enum.TryParse<CompetitionLevel>(level, ignoreCase: true, out var parsed)
            ? parsed
            : throw new ValidationApiException($"Unknown competition level '{level}'.");

    private async Task ValidateValueMetricsAsync(int sportId, List<CreateBenchmarkValueDto> values)
    {
        var metricIds = values.Select(v => v.MetricDefinitionId).Distinct().ToList();
        var valid = await _context.SportMetricDefinitions
            .Where(m => m.SportId == sportId && metricIds.Contains(m.Id))
            .CountAsync();
        if (valid != metricIds.Count)
            throw new ValidationApiException("One or more metrics don't belong to this sport.");
    }

    private async Task<List<BenchmarkValue>> BuildValuesAsync(CreateBenchmarkProfileDto dto, string userId)
    {
        if (dto.Values is { Count: > 0 })
        {
            await ValidateValueMetricsAsync(dto.SportId, dto.Values);
            return dto.Values.Select(v => new BenchmarkValue
            {
                MetricDefinitionId = v.MetricDefinitionId,
                BenchmarkLow = v.BenchmarkLow,
                BenchmarkMid = v.BenchmarkMid,
                BenchmarkHigh = v.BenchmarkHigh,
                Notes = v.Notes,
            }).ToList();
        }

        // Copy from a base profile (system or own)...
        if (dto.BasedOnProfileId is int baseId)
        {
            var baseProfile = await _context.BenchmarkProfiles
                .Include(p => p.Values)
                .FirstOrDefaultAsync(p => p.Id == baseId && (p.IsDefault || p.CoachId == userId))
                ?? throw new NotFoundApiException($"Base profile {baseId} was not found.");
            if (baseProfile.SportId != dto.SportId)
                throw new ValidationApiException("The base profile belongs to a different sport.");
            return baseProfile.Values.Select(v => new BenchmarkValue
            {
                MetricDefinitionId = v.MetricDefinitionId,
                BenchmarkLow = v.BenchmarkLow,
                BenchmarkMid = v.BenchmarkMid,
                BenchmarkHigh = v.BenchmarkHigh,
            }).ToList();
        }

        // ...or from the sport's metric-definition defaults.
        var metrics = await _context.SportMetricDefinitions
            .Where(m => m.SportId == dto.SportId && m.InputType != MetricInputType.Rating)
            .ToListAsync();
        return metrics.Select(m => new BenchmarkValue
        {
            MetricDefinitionId = m.Id,
            BenchmarkLow = m.BenchmarkLow,
            BenchmarkMid = m.BenchmarkMid,
            BenchmarkHigh = m.BenchmarkHigh,
        }).ToList();
    }

    private async Task<BenchmarkProfile> LoadOwnedAsync(int id, string userId)
    {
        var profile = await _context.BenchmarkProfiles
            .Include(p => p.Values)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Benchmark profile {id} was not found.");
        if (profile.IsDefault || profile.CoachId != userId)
            throw new ForbiddenApiException("System profiles are read-only; you can only edit your own.");
        return profile;
    }

    private async Task<BenchmarkProfile> ReloadAsync(int id) =>
        await _context.BenchmarkProfiles
            .Include(p => p.Values).ThenInclude(v => v.MetricDefinition)
            .FirstAsync(p => p.Id == id);

    private static BenchmarkValueDto ToValueDto(BenchmarkValue v) => new()
    {
        MetricDefinitionId = v.MetricDefinitionId,
        MetricName = v.MetricDefinition?.Name ?? "",
        Unit = v.MetricDefinition?.Unit,
        InputType = v.MetricDefinition?.InputType.ToString() ?? "",
        BenchmarkLow = v.BenchmarkLow,
        BenchmarkMid = v.BenchmarkMid,
        BenchmarkHigh = v.BenchmarkHigh,
        Notes = v.Notes,
    };

    private static BenchmarkProfileDto ToDto(BenchmarkProfile p, string userId) => new()
    {
        Id = p.Id,
        SportId = p.SportId,
        Name = p.Name,
        AgeGroupMin = p.AgeGroupMin,
        AgeGroupMax = p.AgeGroupMax,
        CompetitionLevel = p.CompetitionLevel.ToString(),
        IsDefault = p.IsDefault,
        IsMine = p.CoachId == userId,
        Values = p.Values
            .OrderBy(v => v.MetricDefinition?.Name)
            .Select(ToValueDto).ToList(),
    };
}
