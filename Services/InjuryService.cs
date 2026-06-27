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
        var injuries = await _context.InjuryRecords.Where(i => i.PlayerId == playerId)
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
            Severity = dto.Severity,
            RecoveryStatus = dto.RecoveryStatus,
            Notes = dto.Notes,
            ExpectedReturnDate = dto.ExpectedReturnDate
        };
        _context.InjuryRecords.Add(injury);
        await _context.SaveChangesAsync();
        return ToDto(injury);
    }

    public async Task<InjuryRecordDto> UpdateAsync(ClaimsPrincipal user, int id, CreateInjuryRecordDto dto)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new NotFoundApiException($"Injury record {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        injury.InjuryDate = dto.InjuryDate;
        injury.InjuryType = dto.InjuryType;
        injury.Severity = dto.Severity;
        injury.RecoveryStatus = dto.RecoveryStatus;
        injury.Notes = dto.Notes;
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

    private static InjuryRecordDto ToDto(InjuryRecord i) => new()
    {
        Id = i.Id,
        PlayerId = i.PlayerId,
        InjuryDate = i.InjuryDate,
        InjuryType = i.InjuryType,
        Severity = i.Severity,
        RecoveryStatus = i.RecoveryStatus,
        Notes = i.Notes,
        ExpectedReturnDate = i.ExpectedReturnDate
    };
}
