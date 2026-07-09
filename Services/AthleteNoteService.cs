using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAthleteNoteService
{
    Task<List<AthleteNoteDto>> GetMineAsync(ClaimsPrincipal user);
    Task<AthleteNoteDto> CreateAsync(ClaimsPrincipal user, UpsertAthleteNoteDto dto);
    Task<AthleteNoteDto> UpdateAsync(ClaimsPrincipal user, int id, UpsertAthleteNoteDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class AthleteNoteService : IAthleteNoteService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public AthleteNoteService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<AthleteNoteDto>> GetMineAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        var notes = await _context.AthleteNotes
            .Where(n => n.PlayerId == player.Id)
            .OrderByDescending(n => n.UpdatedAt)
            .ToListAsync();
        return notes.Select(ToDto).ToList();
    }

    public async Task<AthleteNoteDto> CreateAsync(ClaimsPrincipal user, UpsertAthleteNoteDto dto)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        Validate(dto);

        var note = new AthleteNote
        {
            PlayerId = player.Id,
            UserId = _access.RequireUserId(user),
            Title = Clean(dto.Title),
            Content = dto.Content.Trim(),
            Category = dto.Category,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _context.AthleteNotes.Add(note);
        await _context.SaveChangesAsync();
        return ToDto(note);
    }

    public async Task<AthleteNoteDto> UpdateAsync(ClaimsPrincipal user, int id, UpsertAthleteNoteDto dto)
    {
        var note = await LoadOwnAsync(user, id);
        Validate(dto);

        note.Title = Clean(dto.Title);
        note.Content = dto.Content.Trim();
        note.Category = dto.Category;
        note.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(note);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var note = await LoadOwnAsync(user, id);
        _context.AthleteNotes.Remove(note);
        await _context.SaveChangesAsync();
    }

    // Loads a note only if it belongs to the caller's own player — otherwise 404
    // (never leaks the existence of another athlete's note).
    private async Task<AthleteNote> LoadOwnAsync(ClaimsPrincipal user, int id)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        return await _context.AthleteNotes.FirstOrDefaultAsync(n => n.Id == id && n.PlayerId == player.Id)
            ?? throw new NotFoundApiException($"Note {id} was not found.");
    }

    private static void Validate(UpsertAthleteNoteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            throw new ValidationApiException("Note content is required.");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static AthleteNoteDto ToDto(AthleteNote n) => new()
    {
        Id = n.Id,
        Title = n.Title,
        Content = n.Content,
        Category = n.Category,
        CreatedAt = n.CreatedAt,
        UpdatedAt = n.UpdatedAt,
    };
}
