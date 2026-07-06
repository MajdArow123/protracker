using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IWellbeingService
{
    Task<List<WellbeingCheckinDto>> GetMineAsync(ClaimsPrincipal user, int days);
    Task<WellbeingCheckinDto?> GetTodayAsync(ClaimsPrincipal user);
    Task<WellbeingCheckinDto> SubmitAsync(ClaimsPrincipal user, CreateWellbeingCheckinDto dto);
    Task<PlayerWellbeingTrendDto> GetPlayerTrendAsync(ClaimsPrincipal user, int playerId, int days);
    Task<TeamWellbeingSummaryDto> GetTeamSummaryAsync(ClaimsPrincipal user);
}

public class WellbeingService : IWellbeingService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public WellbeingService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    private static DateTime Today() => DateTime.UtcNow.Date;

    private async Task<Player> RequireMyPlayerAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        return await _context.Players.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new NotFoundApiException("No player record is linked to your account.");
    }

    public async Task<List<WellbeingCheckinDto>> GetMineAsync(ClaimsPrincipal user, int days)
    {
        var player = await RequireMyPlayerAsync(user);
        var since = Today().AddDays(-Math.Clamp(days, 1, 365) + 1);
        var checkins = await _context.WellbeingCheckins
            .Where(c => c.PlayerId == player.Id && c.Date >= since)
            .OrderBy(c => c.Date)
            .ToListAsync();
        return checkins.Select(ToDto).ToList();
    }

    public async Task<WellbeingCheckinDto?> GetTodayAsync(ClaimsPrincipal user)
    {
        var player = await RequireMyPlayerAsync(user);
        var today = Today();
        var checkin = await _context.WellbeingCheckins
            .FirstOrDefaultAsync(c => c.PlayerId == player.Id && c.Date == today);
        return checkin == null ? null : ToDto(checkin);
    }

    public async Task<WellbeingCheckinDto> SubmitAsync(ClaimsPrincipal user, CreateWellbeingCheckinDto dto)
    {
        var player = await RequireMyPlayerAsync(user);
        Validate(dto);

        var today = Today();
        // Upsert: one check-in per player per day.
        var checkin = await _context.WellbeingCheckins
            .FirstOrDefaultAsync(c => c.PlayerId == player.Id && c.Date == today);

        var hasPain = dto.HasPain;
        var painArea = hasPain ? dto.PainArea?.Trim() : null;
        var painNote = hasPain ? dto.PainNote?.Trim() : null;

        if (checkin == null)
        {
            checkin = new WellbeingCheckin
            {
                PlayerId = player.Id,
                Date = today,
                Feeling = dto.Feeling,
                Energy = dto.Energy,
                Sleep = dto.Sleep,
                HasPain = hasPain,
                PainArea = painArea,
                PainNote = painNote,
                Notes = dto.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow,
            };
            _context.WellbeingCheckins.Add(checkin);
        }
        else
        {
            checkin.Feeling = dto.Feeling;
            checkin.Energy = dto.Energy;
            checkin.Sleep = dto.Sleep;
            checkin.HasPain = hasPain;
            checkin.PainArea = painArea;
            checkin.PainNote = painNote;
            checkin.Notes = dto.Notes?.Trim();
            checkin.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return ToDto(checkin);
    }

    public async Task<PlayerWellbeingTrendDto> GetPlayerTrendAsync(ClaimsPrincipal user, int playerId, int days)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        var since = Today().AddDays(-Math.Clamp(days, 1, 365) + 1);
        var checkins = await _context.WellbeingCheckins
            .Where(c => c.PlayerId == playerId && c.Date >= since)
            .OrderBy(c => c.Date)
            .ToListAsync();

        return new PlayerWellbeingTrendDto
        {
            PlayerId = playerId,
            PlayerName = player.FullName,
            Checkins = checkins.Select(ToDto).ToList(),
            AvgFeeling = checkins.Count > 0 ? checkins.Average(c => c.Feeling) : null,
            AvgEnergy = checkins.Count > 0 ? checkins.Average(c => c.Energy) : null,
            AvgSleep = checkins.Count > 0 ? checkins.Average(c => c.Sleep) : null,
            AvgScore = checkins.Count > 0 ? checkins.Average(c => ScoreOf(c)) : null,
            PainDays = checkins.Count(c => c.HasPain),
        };
    }

    public async Task<TeamWellbeingSummaryDto> GetTeamSummaryAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);

        var players = await _context.Players
            .Where(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value))
            .Include(p => p.Team)
            .ToListAsync();
        var playerIds = players.Select(p => p.Id).ToList();

        var today = Today();
        // Players with a currently-open injury/recovery — used to raise the pain alert.
        var recoveringPlayerIds = await _context.InjuryRecords
            .Where(i => playerIds.Contains(i.PlayerId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .Select(i => i.PlayerId)
            .Distinct()
            .ToHashSetAsync();

        // Latest check-in per player.
        var checkins = await _context.WellbeingCheckins
            .Where(c => playerIds.Contains(c.PlayerId))
            .ToListAsync();
        var latestByPlayer = checkins
            .GroupBy(c => c.PlayerId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.Date).First());

        var rows = new List<TeamWellbeingPlayerDto>();
        foreach (var p in players.OrderBy(p => p.FullName))
        {
            latestByPlayer.TryGetValue(p.Id, out var latest);
            var painDuringRecovery = latest != null && latest.HasPain && recoveringPlayerIds.Contains(p.Id);
            rows.Add(new TeamWellbeingPlayerDto
            {
                PlayerId = p.Id,
                PlayerName = p.FullName,
                TeamName = p.Team?.Name ?? "",
                LatestCheckin = latest == null ? null : ToDto(latest),
                CheckedInToday = latest != null && latest.Date == today,
                PainDuringRecovery = painDuringRecovery,
            });
        }

        var todayScores = rows
            .Where(r => r.CheckedInToday && r.LatestCheckin != null)
            .Select(r => r.LatestCheckin!.Score)
            .ToList();

        return new TeamWellbeingSummaryDto
        {
            Players = rows,
            TotalPlayers = rows.Count,
            CheckedInToday = rows.Count(r => r.CheckedInToday),
            AvgScoreToday = todayScores.Count > 0 ? Math.Round(todayScores.Average(), 1) : null,
            PainAlerts = rows.Count(r => r.PainDuringRecovery),
        };
    }

    private static void Validate(CreateWellbeingCheckinDto dto)
    {
        var errors = new List<string>();
        if (dto.Feeling is < 1 or > 5) errors.Add("Feeling must be between 1 and 5.");
        if (dto.Energy is < 1 or > 5) errors.Add("Energy must be between 1 and 5.");
        if (dto.Sleep is < 1 or > 5) errors.Add("Sleep must be between 1 and 5.");
        if (errors.Count > 0) throw new ValidationApiException(errors);
    }

    // Average of the three 1-5 scales mapped onto 0-10 for consistency with other charts.
    private static double ScoreOf(WellbeingCheckin c) =>
        Math.Round((c.Feeling + c.Energy + c.Sleep) / 3.0 * 2.0, 1);

    private static WellbeingCheckinDto ToDto(WellbeingCheckin c) => new()
    {
        Id = c.Id,
        PlayerId = c.PlayerId,
        Date = c.Date,
        Feeling = c.Feeling,
        Energy = c.Energy,
        Sleep = c.Sleep,
        HasPain = c.HasPain,
        PainArea = c.PainArea,
        PainNote = c.PainNote,
        Notes = c.Notes,
        Score = ScoreOf(c),
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
    };
}
