using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IPersonalGoalService
{
    Task<List<PersonalGoalDto>> GetMineAsync(ClaimsPrincipal user);
    Task<List<PersonalGoalDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<PersonalGoalDto> CreateAsync(ClaimsPrincipal user, CreateGoalDto dto);
    Task<PersonalGoalDto> UpdateAsync(ClaimsPrincipal user, int id, UpdateGoalDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<PersonalGoalDto> AchieveAsync(ClaimsPrincipal user, int id);

    Task<GoalMilestoneDto> AddMilestoneAsync(ClaimsPrincipal user, int goalId, CreateGoalMilestoneDto dto);
    Task<GoalMilestoneDto> AchieveMilestoneAsync(ClaimsPrincipal user, int goalId, int milestoneId);

    Task<GoalProgressDto> LogProgressAsync(ClaimsPrincipal user, int goalId, LogGoalProgressDto dto);
    Task<List<GoalProgressDto>> GetProgressAsync(ClaimsPrincipal user, int goalId);

    // Called by the assessment flow: for each saved stat category, update any active
    // Performance goals linked to it (adds an Assessment progress point + CurrentValue).
    Task SyncFromAssessmentAsync(int playerId, IReadOnlyDictionary<int, decimal> categoryScores);
}

public class PersonalGoalService : IPersonalGoalService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public PersonalGoalService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<PersonalGoalDto>> GetMineAsync(ClaimsPrincipal user)
    {
        var player = await _access.RequireOwnPlayerAsync(user);
        return await GetForPlayerAsync(user, player.Id);
    }

    public async Task<List<PersonalGoalDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var seesPrivate = await CanSeePrivateAsync(user, playerId);

        var goals = await _context.PersonalGoals
            .Include(g => g.Player)
            .Include(g => g.Milestones)
            .Where(g => g.PlayerId == playerId && (seesPrivate || !g.IsPrivate))
            .ToListAsync();

        var catNames = await StatCategoryNamesAsync(goals);

        return goals
            .OrderBy(g => g.Status == GoalStatus.Achieved || g.Status == GoalStatus.Abandoned)
            .ThenBy(g => g.Priority)
            .ThenBy(g => g.TargetDate == null)
            .ThenBy(g => g.TargetDate)
            .ThenByDescending(g => g.CreatedAt)
            .Select(g => ToDto(g, catNames))
            .ToList();
    }

    public async Task<PersonalGoalDto> CreateAsync(ClaimsPrincipal user, CreateGoalDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new ValidationApiException("A goal title is required.");

        var player = await _context.Players.FirstAsync(p => p.Id == dto.PlayerId);

        // A coach may not create a private goal (they'd never be able to see it again).
        var isPrivate = dto.IsPrivate && IsOwner(user, player);

        var goal = new PersonalGoal
        {
            PlayerId = dto.PlayerId,
            UserId = player.UserId,
            Title = dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Category = dto.Category,
            TargetValue = dto.TargetValue,
            CurrentValue = dto.CurrentValue,
            Unit = string.IsNullOrWhiteSpace(dto.Unit) ? null : dto.Unit.Trim(),
            LinkedStatCategoryId = await ValidLinkedCategoryAsync(dto.LinkedStatCategoryId, player.SportId),
            StartDate = dto.StartDate ?? DateTime.UtcNow.Date,
            TargetDate = dto.TargetDate,
            Priority = dto.Priority,
            IsPrivate = isPrivate,
            CreatedAt = DateTime.UtcNow,
        };

        foreach (var m in dto.Milestones.Where(m => !string.IsNullOrWhiteSpace(m.Title)))
        {
            goal.Milestones.Add(new GoalMilestone
            {
                Title = m.Title.Trim(),
                TargetValue = m.TargetValue,
                TargetDate = m.TargetDate,
            });
        }

        _context.PersonalGoals.Add(goal);
        await _context.SaveChangesAsync();

        return await LoadDtoAsync(goal.Id);
    }

    public async Task<PersonalGoalDto> UpdateAsync(ClaimsPrincipal user, int id, UpdateGoalDto dto)
    {
        var goal = await LoadAccessibleGoalAsync(user, id);

        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new ValidationApiException("A goal title is required.");

        var player = await _context.Players.FirstAsync(p => p.Id == goal.PlayerId);

        goal.Title = dto.Title.Trim();
        goal.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        goal.Category = dto.Category;
        goal.TargetValue = dto.TargetValue;
        goal.CurrentValue = dto.CurrentValue;
        goal.Unit = string.IsNullOrWhiteSpace(dto.Unit) ? null : dto.Unit.Trim();
        goal.LinkedStatCategoryId = await ValidLinkedCategoryAsync(dto.LinkedStatCategoryId, player.SportId);
        goal.StartDate = dto.StartDate ?? goal.StartDate;
        goal.TargetDate = dto.TargetDate;
        goal.Priority = dto.Priority;
        // Only the owning athlete may keep a goal private.
        goal.IsPrivate = dto.IsPrivate && IsOwner(user, player);

        // Status transition (also keep AchievedAt in sync).
        if (dto.Status != goal.Status)
        {
            goal.Status = dto.Status;
            goal.AchievedAt = dto.Status == GoalStatus.Achieved ? (goal.AchievedAt ?? DateTime.UtcNow) : null;
        }

        goal.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await LoadDtoAsync(goal.Id);
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var goal = await LoadAccessibleGoalAsync(user, id);
        _context.PersonalGoals.Remove(goal);
        await _context.SaveChangesAsync();
    }

    public async Task<PersonalGoalDto> AchieveAsync(ClaimsPrincipal user, int id)
    {
        var goal = await LoadAccessibleGoalAsync(user, id);
        goal.Status = GoalStatus.Achieved;
        goal.AchievedAt = DateTime.UtcNow;
        goal.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return await LoadDtoAsync(goal.Id);
    }

    public async Task<GoalMilestoneDto> AddMilestoneAsync(ClaimsPrincipal user, int goalId, CreateGoalMilestoneDto dto)
    {
        var goal = await LoadAccessibleGoalAsync(user, goalId);
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new ValidationApiException("A milestone title is required.");

        var milestone = new GoalMilestone
        {
            PersonalGoalId = goal.Id,
            Title = dto.Title.Trim(),
            TargetValue = dto.TargetValue,
            TargetDate = dto.TargetDate,
        };
        _context.GoalMilestones.Add(milestone);
        await _context.SaveChangesAsync();
        return ToMilestoneDto(milestone);
    }

    public async Task<GoalMilestoneDto> AchieveMilestoneAsync(ClaimsPrincipal user, int goalId, int milestoneId)
    {
        await LoadAccessibleGoalAsync(user, goalId);
        var milestone = await _context.GoalMilestones
            .FirstOrDefaultAsync(m => m.Id == milestoneId && m.PersonalGoalId == goalId)
            ?? throw new NotFoundApiException($"Milestone {milestoneId} was not found.");

        milestone.IsAchieved = !milestone.IsAchieved;
        milestone.AchievedAt = milestone.IsAchieved ? DateTime.UtcNow : null;
        await _context.SaveChangesAsync();
        return ToMilestoneDto(milestone);
    }

    public async Task<GoalProgressDto> LogProgressAsync(ClaimsPrincipal user, int goalId, LogGoalProgressDto dto)
    {
        var goal = await LoadAccessibleGoalAsync(user, goalId);

        var entry = new GoalProgress
        {
            PersonalGoalId = goal.Id,
            Value = dto.Value,
            Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            RecordedAt = dto.RecordedAt ?? DateTime.UtcNow,
            Source = GoalProgressSource.Manual,
        };
        _context.GoalProgress.Add(entry);

        goal.CurrentValue = dto.Value;
        goal.UpdatedAt = DateTime.UtcNow;
        AutoAchieveMilestones(goal, dto.Value);

        await _context.SaveChangesAsync();
        return ToProgressDto(entry);
    }

    public async Task<List<GoalProgressDto>> GetProgressAsync(ClaimsPrincipal user, int goalId)
    {
        await LoadAccessibleGoalAsync(user, goalId);
        var entries = await _context.GoalProgress
            .Where(p => p.PersonalGoalId == goalId)
            .OrderBy(p => p.RecordedAt)
            .ToListAsync();
        return entries.Select(ToProgressDto).ToList();
    }

    public async Task SyncFromAssessmentAsync(int playerId, IReadOnlyDictionary<int, decimal> categoryScores)
    {
        if (categoryScores.Count == 0) return;

        var catIds = categoryScores.Keys.ToList();
        var goals = await _context.PersonalGoals
            .Include(g => g.Milestones)
            .Where(g => g.PlayerId == playerId
                        && g.Status == GoalStatus.Active
                        && g.LinkedStatCategoryId != null
                        && catIds.Contains(g.LinkedStatCategoryId!.Value))
            .ToListAsync();

        if (goals.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var goal in goals)
        {
            var value = categoryScores[goal.LinkedStatCategoryId!.Value];
            _context.GoalProgress.Add(new GoalProgress
            {
                PersonalGoalId = goal.Id,
                Value = value,
                Note = "Auto-updated from assessment",
                RecordedAt = now,
                Source = GoalProgressSource.Assessment,
            });
            goal.CurrentValue = value;
            goal.UpdatedAt = now;
            AutoAchieveMilestones(goal, value);
        }
        await _context.SaveChangesAsync();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static void AutoAchieveMilestones(PersonalGoal goal, decimal value)
    {
        foreach (var m in goal.Milestones.Where(m => !m.IsAchieved && m.TargetValue != null && value >= m.TargetValue))
        {
            m.IsAchieved = true;
            m.AchievedAt = DateTime.UtcNow;
        }
    }

    private static bool IsSelfOwnedAthlete(ClaimsPrincipal user) =>
        user.IsInRole("Athlete") || user.IsInRole("SoloAthlete");

    private bool IsOwner(ClaimsPrincipal user, Player player) =>
        IsSelfOwnedAthlete(user) && player.UserId != null && player.UserId == _access.RequireUserId(user);

    // Whether the caller is allowed to see this player's private goals (only the owner).
    private async Task<bool> CanSeePrivateAsync(ClaimsPrincipal user, int playerId)
    {
        if (user.IsInRole("Admin")) return true;
        if (!IsSelfOwnedAthlete(user)) return false;
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId);
        return player != null && IsOwner(user, player);
    }

    // Loads a goal the caller may mutate: enforces player access AND the private-goal guard
    // (a coach can never touch a private goal, even of their own player).
    private async Task<PersonalGoal> LoadAccessibleGoalAsync(ClaimsPrincipal user, int id)
    {
        var goal = await _context.PersonalGoals
            .Include(g => g.Milestones)
            .FirstOrDefaultAsync(g => g.Id == id)
            ?? throw new NotFoundApiException($"Goal {id} was not found.");

        await _access.EnsureCanAccessPlayerAsync(user, goal.PlayerId);

        if (goal.IsPrivate && !await CanSeePrivateAsync(user, goal.PlayerId))
            throw new ForbiddenApiException("This goal is private to the athlete.");

        return goal;
    }

    // Guards a linked stat category actually belongs to the player's sport.
    private async Task<int?> ValidLinkedCategoryAsync(int? categoryId, int sportId)
    {
        if (categoryId is not int id) return null;
        var ok = await _context.SportStatCategories.AnyAsync(c => c.Id == id && c.SportId == sportId);
        return ok ? id : null;
    }

    private async Task<Dictionary<int, string>> StatCategoryNamesAsync(IEnumerable<PersonalGoal> goals)
    {
        var ids = goals.Where(g => g.LinkedStatCategoryId != null)
            .Select(g => g.LinkedStatCategoryId!.Value).Distinct().ToList();
        if (ids.Count == 0) return new();
        return await _context.SportStatCategories
            .Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);
    }

    private async Task<PersonalGoalDto> LoadDtoAsync(int id)
    {
        var goal = await _context.PersonalGoals
            .Include(g => g.Player)
            .Include(g => g.Milestones)
            .FirstAsync(g => g.Id == id);
        var catNames = await StatCategoryNamesAsync(new[] { goal });
        return ToDto(goal, catNames);
    }

    private static double? ComputeProgressPercent(PersonalGoal g)
    {
        if (g.Status == GoalStatus.Achieved) return 100;
        if (g.TargetValue is not decimal target || target == 0 || g.CurrentValue is not decimal current)
            return null;
        var pct = (double)(current / target) * 100.0;
        return Math.Round(Math.Clamp(pct, 0, 100), 0);
    }

    private static PersonalGoalDto ToDto(PersonalGoal g, IReadOnlyDictionary<int, string> catNames) => new()
    {
        Id = g.Id,
        PlayerId = g.PlayerId,
        PlayerName = g.Player?.FullName ?? "",
        Title = g.Title,
        Description = g.Description,
        Category = g.Category,
        TargetValue = g.TargetValue,
        CurrentValue = g.CurrentValue,
        Unit = g.Unit,
        LinkedStatCategoryId = g.LinkedStatCategoryId,
        LinkedStatCategoryName = g.LinkedStatCategoryId != null && catNames.TryGetValue(g.LinkedStatCategoryId.Value, out var n) ? n : null,
        StartDate = g.StartDate,
        TargetDate = g.TargetDate,
        Status = g.Status,
        Priority = g.Priority,
        IsPrivate = g.IsPrivate,
        CreatedAt = g.CreatedAt,
        UpdatedAt = g.UpdatedAt,
        AchievedAt = g.AchievedAt,
        ProgressPercent = ComputeProgressPercent(g),
        Milestones = g.Milestones
            .OrderBy(m => m.TargetValue == null)
            .ThenBy(m => m.TargetValue)
            .ThenBy(m => m.Id)
            .Select(ToMilestoneDto).ToList(),
    };

    private static GoalMilestoneDto ToMilestoneDto(GoalMilestone m) => new()
    {
        Id = m.Id,
        PersonalGoalId = m.PersonalGoalId,
        Title = m.Title,
        TargetValue = m.TargetValue,
        IsAchieved = m.IsAchieved,
        AchievedAt = m.AchievedAt,
        TargetDate = m.TargetDate,
    };

    private static GoalProgressDto ToProgressDto(GoalProgress p) => new()
    {
        Id = p.Id,
        PersonalGoalId = p.PersonalGoalId,
        Value = p.Value,
        Note = p.Note,
        RecordedAt = p.RecordedAt,
        Source = p.Source,
    };
}
