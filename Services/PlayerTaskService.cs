using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IPlayerTaskService
{
    Task<List<PlayerTaskDto>> GetForCoachAsync(ClaimsPrincipal user, int? playerId, bool? completed, TaskPriority? priority);
    Task<List<PlayerTaskDto>> GetMineAsync(ClaimsPrincipal user);
    Task<PlayerTaskDto> CreateAsync(ClaimsPrincipal user, CreatePlayerTaskDto dto);
    Task<PlayerTaskDto> UpdateAsync(ClaimsPrincipal user, int id, CreatePlayerTaskDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<PlayerTaskDto> CompleteAsync(ClaimsPrincipal user, int id, CompleteTaskDto dto);
    Task<PlayerTaskDto> IncompleteAsync(ClaimsPrincipal user, int id);
}

public class PlayerTaskService : IPlayerTaskService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public PlayerTaskService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<PlayerTaskDto>> GetForCoachAsync(ClaimsPrincipal user, int? playerId, bool? completed, TaskPriority? priority)
    {
        var userId = _access.RequireUserId(user);

        var query = _context.PlayerTasks.Include(t => t.Player).AsQueryable();

        // Coaches only ever see tasks they created; Admins see everything.
        if (!user.IsInRole("Admin"))
            query = query.Where(t => t.CoachId == userId);

        if (playerId.HasValue)
            query = query.Where(t => t.PlayerId == playerId.Value);
        if (completed.HasValue)
            query = query.Where(t => t.IsCompleted == completed.Value);
        if (priority.HasValue)
            query = query.Where(t => t.Priority == priority.Value);

        var tasks = await query
            .OrderBy(t => t.IsCompleted)
            .ThenBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        return tasks.Select(ToDto).ToList();
    }

    public async Task<List<PlayerTaskDto>> GetMineAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new NotFoundApiException("No player record is linked to your account.");

        var tasks = await _context.PlayerTasks.Include(t => t.Player)
            .Where(t => t.PlayerId == player.Id)
            .OrderBy(t => t.IsCompleted)
            .ThenBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        return tasks.Select(ToDto).ToList();
    }

    public async Task<PlayerTaskDto> CreateAsync(ClaimsPrincipal user, CreatePlayerTaskDto dto)
    {
        // Coaches may only assign to players on a team they scope.
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);
        var userId = _access.RequireUserId(user);

        var task = new PlayerTask
        {
            CoachId = userId,
            PlayerId = dto.PlayerId,
            Title = dto.Title.Trim(),
            Description = dto.Description,
            DueDate = dto.DueDate,
            Priority = dto.Priority,
            Category = dto.Category,
            CreatedAt = DateTime.UtcNow,
        };
        _context.PlayerTasks.Add(task);
        await _context.SaveChangesAsync();

        await _context.Entry(task).Reference(t => t.Player).LoadAsync();
        return ToDto(task);
    }

    public async Task<PlayerTaskDto> UpdateAsync(ClaimsPrincipal user, int id, CreatePlayerTaskDto dto)
    {
        var task = await LoadOwnedTaskAsync(user, id);
        // Re-validate access to the (possibly reassigned) player.
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        task.PlayerId = dto.PlayerId;
        task.Title = dto.Title.Trim();
        task.Description = dto.Description;
        task.DueDate = dto.DueDate;
        task.Priority = dto.Priority;
        task.Category = dto.Category;
        await _context.SaveChangesAsync();

        await _context.Entry(task).Reference(t => t.Player).LoadAsync();
        return ToDto(task);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var task = await LoadOwnedTaskAsync(user, id);
        _context.PlayerTasks.Remove(task);
        await _context.SaveChangesAsync();
    }

    public async Task<PlayerTaskDto> CompleteAsync(ClaimsPrincipal user, int id, CompleteTaskDto dto)
    {
        var task = await _context.PlayerTasks.Include(t => t.Player)
            .FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Task {id} was not found.");
        // Athlete-owns-player or coach-owns-team both pass here.
        await _access.EnsureCanAccessPlayerAsync(user, task.PlayerId);

        task.IsCompleted = true;
        task.CompletedAt = DateTime.UtcNow;
        task.CompletedNote = dto.CompletedNote;
        await _context.SaveChangesAsync();
        return ToDto(task);
    }

    public async Task<PlayerTaskDto> IncompleteAsync(ClaimsPrincipal user, int id)
    {
        var task = await _context.PlayerTasks.Include(t => t.Player)
            .FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Task {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, task.PlayerId);

        task.IsCompleted = false;
        task.CompletedAt = null;
        task.CompletedNote = null;
        await _context.SaveChangesAsync();
        return ToDto(task);
    }

    // A coach/admin may only edit or delete a task they created.
    private async Task<PlayerTask> LoadOwnedTaskAsync(ClaimsPrincipal user, int id)
    {
        var task = await _context.PlayerTasks.Include(t => t.Player)
            .FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Task {id} was not found.");

        if (!user.IsInRole("Admin"))
        {
            var userId = _access.RequireUserId(user);
            if (task.CoachId != userId)
                throw new ForbiddenApiException("You can only modify tasks you created.");
        }
        return task;
    }

    private static PlayerTaskDto ToDto(PlayerTask t) => new()
    {
        Id = t.Id,
        CoachId = t.CoachId,
        PlayerId = t.PlayerId,
        PlayerName = t.Player?.FullName ?? "",
        Title = t.Title,
        Description = t.Description,
        DueDate = t.DueDate,
        Priority = t.Priority,
        Category = t.Category,
        IsCompleted = t.IsCompleted,
        CompletedAt = t.CompletedAt,
        CompletedNote = t.CompletedNote,
        CreatedAt = t.CreatedAt,
    };
}
