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
    Task<TaskAnalyticsDto> GetAnalyticsAsync(ClaimsPrincipal user);
}

public class PlayerTaskService : IPlayerTaskService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly INotificationService _notifications;

    public PlayerTaskService(ApplicationDbContext context, IAccessControlService access, INotificationService notifications)
    {
        _context = context;
        _access = access;
        _notifications = notifications;
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

        return await ToDtosWithDrillsAsync(tasks);
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

        return await ToDtosWithDrillsAsync(tasks);
    }

    // Maps tasks to DTOs and resolves the source drill's difficulty for drill-based tasks.
    private async Task<List<PlayerTaskDto>> ToDtosWithDrillsAsync(List<PlayerTask> tasks)
    {
        var drillIds = tasks.Where(t => t.DrillId != null).Select(t => t.DrillId!.Value).Distinct().ToList();
        var difficulties = drillIds.Count == 0
            ? new Dictionary<int, DrillDifficulty>()
            : await _context.Drills.Where(d => drillIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => d.Difficulty);

        return tasks.Select(t =>
        {
            var dto = ToDto(t);
            if (t.DrillId != null && difficulties.TryGetValue(t.DrillId.Value, out var diff))
                dto.DrillDifficulty = diff;
            return dto;
        }).ToList();
    }

    public async Task<PlayerTaskDto> CreateAsync(ClaimsPrincipal user, CreatePlayerTaskDto dto)
    {
        // Coaches may only assign to players on a team they scope.
        await _access.EnsurePlayerPermissionAsync(user, dto.PlayerId, p => p.CanAssignTasks,
            "You don't have permission to assign tasks on this team.");
        var userId = _access.RequireUserId(user);

        var task = new PlayerTask
        {
            CoachId = userId,
            PlayerId = dto.PlayerId,
            DrillId = dto.DrillId,
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

        // Notify the athlete their coach assigned a task (skip self-assigned solo tasks).
        if (!string.IsNullOrEmpty(task.Player.UserId) && task.Player.UserId != userId)
            await _notifications.CreateAsync(task.Player.UserId,
                "New task assigned",
                $"{task.Priority} · {task.Title}",
                NotificationType.NewTask,
                actionUrl: "/player-dashboard/tasks",
                relatedEntityId: task.Id, relatedEntityType: "PlayerTask");

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

    public async Task<TaskAnalyticsDto> GetAnalyticsAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);

        // Same scoping as the coach task list: own tasks only (admins see all).
        var query = _context.PlayerTasks.Include(t => t.Player).AsQueryable();
        if (!user.IsInRole("Admin"))
            query = query.Where(t => t.CoachId == userId);
        var tasks = await query.ToListAsync();

        var now = DateTime.UtcNow;
        bool IsOverdue(PlayerTask t) => !t.IsCompleted && t.DueDate.HasValue && t.DueDate.Value < now;

        var total = tasks.Count;
        var completed = tasks.Count(t => t.IsCompleted);
        var overdue = tasks.Count(IsOverdue);

        // Average calendar days from assignment to completion (completed tasks only).
        var completedDurations = tasks
            .Where(t => t.IsCompleted && t.CompletedAt.HasValue)
            .Select(t => (t.CompletedAt!.Value - t.CreatedAt).TotalDays)
            .Where(d => d >= 0)
            .ToList();
        double? avgDays = completedDurations.Count > 0
            ? Math.Round(completedDurations.Average(), 1)
            : null;

        // Per-player breakdown.
        var playerStats = tasks
            .GroupBy(t => new { t.PlayerId, Name = t.Player?.FullName ?? "" })
            .Select(g =>
            {
                var t = g.Count();
                var c = g.Count(x => x.IsCompleted);
                return new PlayerTaskStatsDto
                {
                    PlayerId = g.Key.PlayerId,
                    PlayerName = g.Key.Name,
                    Total = t,
                    Completed = c,
                    Overdue = g.Count(IsOverdue),
                    CompletionRate = t > 0 ? Math.Round(c * 100.0 / t, 0) : 0,
                };
            })
            .OrderByDescending(p => p.CompletionRate)
            .ThenByDescending(p => p.Total)
            .ToList();

        // Per-category breakdown (every category, even if zero, for a stable chart).
        var categoryStats = Enum.GetValues<TaskCategory>()
            .Select(cat =>
            {
                var inCat = tasks.Where(t => t.Category == cat).ToList();
                var c = inCat.Count(t => t.IsCompleted);
                return new TaskCategoryStatsDto
                {
                    Category = cat,
                    Total = inCat.Count,
                    Completed = c,
                    CompletionRate = inCat.Count > 0 ? Math.Round(c * 100.0 / inCat.Count, 0) : 0,
                };
            })
            .Where(c => c.Total > 0)
            .ToList();

        // Last 8 weeks (Monday-based): tasks assigned (by CreatedAt) vs completed (by CompletedAt).
        var weeklyTrend = new List<WeeklyTaskTrendDto>();
        var thisWeekStart = StartOfWeek(now.Date);
        for (var i = 7; i >= 0; i--)
        {
            var weekStart = thisWeekStart.AddDays(-7 * i);
            var weekEnd = weekStart.AddDays(7);
            weeklyTrend.Add(new WeeklyTaskTrendDto
            {
                WeekStart = weekStart,
                WeekLabel = weekStart.ToString("MMM d"),
                Assigned = tasks.Count(t => t.CreatedAt >= weekStart && t.CreatedAt < weekEnd),
                Completed = tasks.Count(t => t.IsCompleted && t.CompletedAt.HasValue && t.CompletedAt.Value >= weekStart && t.CompletedAt.Value < weekEnd),
            });
        }

        // Callouts over players who actually have tasks assigned.
        var eligible = playerStats.Where(p => p.Total >= 1).ToList();
        var topPerformer = eligible
            .OrderByDescending(p => p.CompletionRate).ThenByDescending(p => p.Completed)
            .FirstOrDefault();
        // Prefer a player who isn't already the top performer, so the two callouts differ
        // (falls back to allowing the same player only when there's a single one).
        var needsAttention = eligible
            .Where(p => p.Overdue > 0 || p.CompletionRate < 100)
            .OrderByDescending(p => p.Overdue).ThenBy(p => p.CompletionRate).ThenByDescending(p => p.Total)
            .FirstOrDefault(p => topPerformer == null || p.PlayerId != topPerformer.PlayerId)
            ?? eligible
                .Where(p => p.Overdue > 0 || p.CompletionRate < 100)
                .OrderByDescending(p => p.Overdue).ThenBy(p => p.CompletionRate)
                .FirstOrDefault();

        return new TaskAnalyticsDto
        {
            Total = total,
            Completed = completed,
            Pending = total - completed,
            Overdue = overdue,
            CompletionRate = total > 0 ? Math.Round(completed * 100.0 / total, 0) : 0,
            AvgDaysToComplete = avgDays,
            PlayerStats = playerStats,
            CategoryStats = categoryStats,
            WeeklyTrend = weeklyTrend,
            TopPerformer = topPerformer,
            NeedsAttention = needsAttention,
        };
    }

    // Monday as the first day of the week (UTC dates).
    private static DateTime StartOfWeek(DateTime date)
    {
        int diff = ((int)date.DayOfWeek + 6) % 7; // Mon=0 … Sun=6
        return date.AddDays(-diff).Date;
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
        DrillId = t.DrillId,
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
