using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface ICoachNoteService
{
    Task<List<CoachNoteDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<CoachNoteDto> CreateAsync(ClaimsPrincipal user, int playerId, CreateCoachNoteDto dto);
    Task<CoachNoteDto> UpdateAsync(ClaimsPrincipal user, int id, CreateCoachNoteDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
}

public class CoachNoteService : ICoachNoteService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public CoachNoteService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<CoachNoteDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var query = _context.CoachNotes.Where(n => n.PlayerId == playerId);
        // Athletes only ever see shared notes; coaches/admins see everything.
        if (!user.IsInRole("Coach") && !user.IsInRole("Admin"))
            query = query.Where(n => !n.IsPrivate);
        var notes = await query.OrderByDescending(n => n.CreatedAt).ToListAsync();
        return notes.Select(ToDto).ToList();
    }

    public async Task<CoachNoteDto> CreateAsync(ClaimsPrincipal user, int playerId, CreateCoachNoteDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var userId = _access.RequireUserId(user);
        var coachName = await ResolveCoachNameAsync(userId);

        var note = new CoachNote
        {
            PlayerId = playerId,
            CoachId = userId,
            CoachName = coachName,
            Content = dto.Content.Trim(),
            Category = dto.Category,
            IsPrivate = dto.IsPrivate,
        };
        _context.CoachNotes.Add(note);
        await _context.SaveChangesAsync();
        return ToDto(note);
    }

    public async Task<CoachNoteDto> UpdateAsync(ClaimsPrincipal user, int id, CreateCoachNoteDto dto)
    {
        var note = await LoadAsync(id);
        await _access.EnsureCanAccessPlayerAsync(user, note.PlayerId);
        // A coach may only edit their own notes (Admins may edit any).
        var userId = _access.RequireUserId(user);
        if (!user.IsInRole("Admin") && note.CoachId != userId)
            throw new ForbiddenApiException("You can only edit your own notes.");

        note.Content = dto.Content.Trim();
        note.Category = dto.Category;
        note.IsPrivate = dto.IsPrivate;
        note.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(note);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var note = await LoadAsync(id);
        await _access.EnsureCanAccessPlayerAsync(user, note.PlayerId);
        var userId = _access.RequireUserId(user);
        if (!user.IsInRole("Admin") && note.CoachId != userId)
            throw new ForbiddenApiException("You can only delete your own notes.");

        _context.CoachNotes.Remove(note);
        await _context.SaveChangesAsync();
    }

    private async Task<CoachNote> LoadAsync(int id)
    {
        return await _context.CoachNotes.FirstOrDefaultAsync(n => n.Id == id)
            ?? throw new NotFoundApiException($"Note {id} was not found.");
    }

    private async Task<string> ResolveCoachNameAsync(string userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        return user?.DisplayName ?? "";
    }

    private static CoachNoteDto ToDto(CoachNote n) => new()
    {
        Id = n.Id,
        PlayerId = n.PlayerId,
        CoachId = n.CoachId,
        CoachName = n.CoachName,
        Content = n.Content,
        Category = n.Category,
        IsPrivate = n.IsPrivate,
        CreatedAt = n.CreatedAt,
        UpdatedAt = n.UpdatedAt,
    };
}
