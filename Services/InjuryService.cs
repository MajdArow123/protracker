using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IInjuryService
{
    Task<List<InjuryRecordDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<InjuryRecordDto> CreateAsync(ClaimsPrincipal user, CreateInjuryRecordDto dto);
    Task<InjuryRecordDto> UpdateAsync(ClaimsPrincipal user, int id, CreateInjuryRecordDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<List<InjuryRecordDto>> GetActiveForCoachAsync(ClaimsPrincipal user);
    Task<InjuryRecordDto> RecoverAsync(ClaimsPrincipal user, int id);
}

public class InjuryService : IInjuryService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public InjuryService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<InjuryRecordDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var injuries = await _context.InjuryRecords.Include(i => i.Player)
            .Where(i => i.PlayerId == playerId)
            .OrderByDescending(i => i.InjuryDate).ToListAsync();
        return injuries.Select(ToDto).ToList();
    }

    public async Task<InjuryRecordDto> CreateAsync(ClaimsPrincipal user, CreateInjuryRecordDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        var injury = new InjuryRecord
        {
            PlayerId = dto.PlayerId,
            InjuryDate = dto.InjuryDate,
            InjuryType = dto.InjuryType,
            BodyPart = dto.BodyPart,
            Severity = dto.Severity,
            RecoveryStatus = dto.RecoveryStatus,
            Notes = dto.Notes,
            TreatmentPlan = dto.TreatmentPlan,
            ExpectedReturnDate = dto.ExpectedReturnDate,
            RecoveredDate = dto.RecoveryStatus == RecoveryStatus.FullyRecovered ? DateTime.UtcNow : null,
        };
        _context.InjuryRecords.Add(injury);
        await _context.SaveChangesAsync();
        await _context.Entry(injury).Reference(i => i.Player).LoadAsync();
        return ToDto(injury);
    }

    public async Task<InjuryRecordDto> UpdateAsync(ClaimsPrincipal user, int id, CreateInjuryRecordDto dto)
    {
        var injury = await _context.InjuryRecords.Include(i => i.Player).FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new NotFoundApiException($"Injury record {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        // Stamp/clear the recovered date as the status crosses the recovered boundary.
        if (dto.RecoveryStatus == RecoveryStatus.FullyRecovered && injury.RecoveryStatus != RecoveryStatus.FullyRecovered)
            injury.RecoveredDate = DateTime.UtcNow;
        else if (dto.RecoveryStatus != RecoveryStatus.FullyRecovered)
            injury.RecoveredDate = null;

        injury.InjuryDate = dto.InjuryDate;
        injury.InjuryType = dto.InjuryType;
        injury.BodyPart = dto.BodyPart;
        injury.Severity = dto.Severity;
        injury.RecoveryStatus = dto.RecoveryStatus;
        injury.Notes = dto.Notes;
        injury.TreatmentPlan = dto.TreatmentPlan;
        injury.ExpectedReturnDate = dto.ExpectedReturnDate;
        await _context.SaveChangesAsync();
        return ToDto(injury);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new NotFoundApiException($"Injury record {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        _context.InjuryRecords.Remove(injury);
        await _context.SaveChangesAsync();
    }

    public async Task<List<InjuryRecordDto>> GetActiveForCoachAsync(ClaimsPrincipal user)
    {
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var injuries = await _context.InjuryRecords.Include(i => i.Player)
            .Where(i => teamIds.Contains(i.Player.TeamId) && i.RecoveryStatus != RecoveryStatus.FullyRecovered)
            .OrderByDescending(i => i.Severity)
            .ThenByDescending(i => i.InjuryDate)
            .ToListAsync();
        return injuries.Select(ToDto).ToList();
    }

    public async Task<InjuryRecordDto> RecoverAsync(ClaimsPrincipal user, int id)
    {
        var injury = await _context.InjuryRecords.Include(i => i.Player).FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new NotFoundApiException($"Injury record {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        injury.RecoveryStatus = RecoveryStatus.FullyRecovered;
        injury.RecoveredDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(injury);
    }

    private static InjuryRecordDto ToDto(InjuryRecord i) => new()
    {
        Id = i.Id,
        PlayerId = i.PlayerId,
        PlayerName = i.Player?.FullName ?? "",
        InjuryDate = i.InjuryDate,
        InjuryType = i.InjuryType,
        BodyPart = i.BodyPart,
        Severity = i.Severity,
        RecoveryStatus = i.RecoveryStatus,
        IsRecovered = i.RecoveryStatus == RecoveryStatus.FullyRecovered,
        Notes = i.Notes,
        TreatmentPlan = i.TreatmentPlan,
        ExpectedReturnDate = i.ExpectedReturnDate,
        RecoveredDate = i.RecoveredDate,
    };
}
