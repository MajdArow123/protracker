using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

// Fully-structured plan used by the AI generator to persist a new program.
public class GeneratedRecoveryPlan
{
    public string Title { get; set; } = "";
    public int EstimatedWeeks { get; set; }
    public List<RecoveryExercise> Exercises { get; set; } = new();
    public List<RecoveryMilestone> Milestones { get; set; } = new();
}

public interface IRecoveryPlanService
{
    Task<RecoveryPlanDto?> GetForInjuryAsync(ClaimsPrincipal user, int injuryId);
    Task<RecoveryPlanDto?> GetActiveForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<RecoveryPlanDto> CreateAsync(ClaimsPrincipal user, int injuryId, CreateRecoveryPlanDto dto);
    Task<RecoveryPlanDto> UpdateAsync(ClaimsPrincipal user, int planId, UpdateRecoveryPlanDto dto);
    Task<RecoveryPlanDto> AddExerciseAsync(ClaimsPrincipal user, int planId, CreateRecoveryExerciseDto dto);
    Task<RecoveryPlanDto> UpdateExerciseAsync(ClaimsPrincipal user, int exerciseId, CreateRecoveryExerciseDto dto);
    Task<RecoveryPlanDto> DeleteExerciseAsync(ClaimsPrincipal user, int exerciseId);
    Task<RecoveryPlanDto> CompleteExerciseAsync(ClaimsPrincipal user, int exerciseId, CompleteRecoveryExerciseDto dto);
    Task<RecoveryPlanDto> AddMilestoneAsync(ClaimsPrincipal user, int planId, CreateRecoveryMilestoneDto dto);
    Task<RecoveryPlanDto> AchieveMilestoneAsync(ClaimsPrincipal user, int milestoneId, AchieveMilestoneDto dto);
    Task<RecoveryPlanDto> SaveGeneratedPlanAsync(ClaimsPrincipal user, int injuryId, GeneratedRecoveryPlan generated);
}

public class RecoveryPlanService : IRecoveryPlanService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public RecoveryPlanService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<RecoveryPlanDto?> GetForInjuryAsync(ClaimsPrincipal user, int injuryId)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == injuryId)
            ?? throw new NotFoundApiException($"Injury {injuryId} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);
        var plan = await LoadByInjuryAsync(injuryId);
        return plan == null ? null : await ToDtoAsync(plan);
    }

    public async Task<RecoveryPlanDto?> GetActiveForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var plan = await _context.InjuryRecoveryPlans
            .Include(p => p.Exercises)
            .Include(p => p.Milestones)
            .Where(p => p.PlayerId == playerId && p.Status == RecoveryPlanStatus.Active)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();
        return plan == null ? null : await ToDtoAsync(plan);
    }

    public async Task<RecoveryPlanDto> CreateAsync(ClaimsPrincipal user, int injuryId, CreateRecoveryPlanDto dto)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == injuryId)
            ?? throw new NotFoundApiException($"Injury {injuryId} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        if (await _context.InjuryRecoveryPlans.AnyAsync(p => p.InjuryRecordId == injuryId))
            throw new ValidationApiException("A recovery plan already exists for this injury.");

        var plan = new InjuryRecoveryPlan
        {
            InjuryRecordId = injuryId,
            PlayerId = injury.PlayerId,
            CoachId = _access.RequireUserId(user),
            Title = string.IsNullOrWhiteSpace(dto.Title) ? $"{injury.InjuryType} Recovery Program" : dto.Title.Trim(),
            EstimatedWeeks = dto.EstimatedWeeks > 0 ? dto.EstimatedWeeks : 4,
            CurrentWeek = 1,
            Status = RecoveryPlanStatus.Active,
            Notes = dto.Notes,
        };
        _context.InjuryRecoveryPlans.Add(plan);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    public async Task<RecoveryPlanDto> UpdateAsync(ClaimsPrincipal user, int planId, UpdateRecoveryPlanDto dto)
    {
        var plan = await LoadAsync(planId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        plan.Title = dto.Title.Trim();
        plan.EstimatedWeeks = dto.EstimatedWeeks;
        plan.CurrentWeek = dto.CurrentWeek;
        plan.Status = dto.Status;
        plan.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        return await ToDtoAsync(plan);
    }

    public async Task<RecoveryPlanDto> AddExerciseAsync(ClaimsPrincipal user, int planId, CreateRecoveryExerciseDto dto)
    {
        var plan = await LoadAsync(planId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        _context.RecoveryExercises.Add(MapExercise(new RecoveryExercise { InjuryRecoveryPlanId = planId }, dto));
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(planId));
    }

    public async Task<RecoveryPlanDto> UpdateExerciseAsync(ClaimsPrincipal user, int exerciseId, CreateRecoveryExerciseDto dto)
    {
        var ex = await _context.RecoveryExercises.FirstOrDefaultAsync(e => e.Id == exerciseId)
            ?? throw new NotFoundApiException($"Exercise {exerciseId} was not found.");
        var plan = await LoadAsync(ex.InjuryRecoveryPlanId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        MapExercise(ex, dto);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    public async Task<RecoveryPlanDto> DeleteExerciseAsync(ClaimsPrincipal user, int exerciseId)
    {
        var ex = await _context.RecoveryExercises.FirstOrDefaultAsync(e => e.Id == exerciseId)
            ?? throw new NotFoundApiException($"Exercise {exerciseId} was not found.");
        var plan = await LoadAsync(ex.InjuryRecoveryPlanId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        _context.RecoveryExercises.Remove(ex);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    public async Task<RecoveryPlanDto> CompleteExerciseAsync(ClaimsPrincipal user, int exerciseId, CompleteRecoveryExerciseDto dto)
    {
        var ex = await _context.RecoveryExercises.FirstOrDefaultAsync(e => e.Id == exerciseId)
            ?? throw new NotFoundApiException($"Exercise {exerciseId} was not found.");
        var plan = await LoadAsync(ex.InjuryRecoveryPlanId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId); // athlete (own) or coach (scope)

        ex.IsCompleted = true;
        ex.CompletedAt = DateTime.UtcNow;
        ex.CompletedNote = dto.CompletedNote;
        if (dto.DifficultyRating is >= 1 and <= 5) ex.DifficultyRating = dto.DifficultyRating;
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    public async Task<RecoveryPlanDto> AddMilestoneAsync(ClaimsPrincipal user, int planId, CreateRecoveryMilestoneDto dto)
    {
        var plan = await LoadAsync(planId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        _context.RecoveryMilestones.Add(new RecoveryMilestone { InjuryRecoveryPlanId = planId, Title = dto.Title.Trim(), TargetWeek = dto.TargetWeek });
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(planId));
    }

    public async Task<RecoveryPlanDto> AchieveMilestoneAsync(ClaimsPrincipal user, int milestoneId, AchieveMilestoneDto dto)
    {
        var m = await _context.RecoveryMilestones.FirstOrDefaultAsync(x => x.Id == milestoneId)
            ?? throw new NotFoundApiException($"Milestone {milestoneId} was not found.");
        var plan = await LoadAsync(m.InjuryRecoveryPlanId);
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);
        m.IsAchieved = !m.IsAchieved; // toggle
        m.AchievedAt = m.IsAchieved ? DateTime.UtcNow : null;
        if (dto.Notes != null) m.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    public async Task<RecoveryPlanDto> SaveGeneratedPlanAsync(ClaimsPrincipal user, int injuryId, GeneratedRecoveryPlan generated)
    {
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == injuryId)
            ?? throw new NotFoundApiException($"Injury {injuryId} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, injury.PlayerId);

        // Regenerating replaces any existing plan for this injury.
        var existing = await _context.InjuryRecoveryPlans.Where(p => p.InjuryRecordId == injuryId).ToListAsync();
        if (existing.Count > 0) _context.InjuryRecoveryPlans.RemoveRange(existing);

        var plan = new InjuryRecoveryPlan
        {
            InjuryRecordId = injuryId,
            PlayerId = injury.PlayerId,
            CoachId = _access.RequireUserId(user),
            Title = generated.Title,
            EstimatedWeeks = generated.EstimatedWeeks > 0 ? generated.EstimatedWeeks : 4,
            CurrentWeek = 1,
            Status = RecoveryPlanStatus.Active,
            Exercises = generated.Exercises,
            Milestones = generated.Milestones,
        };
        _context.InjuryRecoveryPlans.Add(plan);
        await _context.SaveChangesAsync();
        return await ToDtoAsync(await LoadAsync(plan.Id));
    }

    // ── helpers ──────────────────────────────────────────────────────────────
    private static RecoveryExercise MapExercise(RecoveryExercise ex, CreateRecoveryExerciseDto dto)
    {
        ex.Title = dto.Title.Trim();
        ex.Description = dto.Description;
        ex.Sets = dto.Sets;
        ex.Reps = dto.Reps;
        ex.DurationMinutes = dto.DurationMinutes;
        ex.RestSeconds = dto.RestSeconds;
        ex.Week = dto.Week;
        ex.DayOfWeek = dto.DayOfWeek;
        ex.Category = dto.Category;
        return ex;
    }

    private Task<InjuryRecoveryPlan?> LoadByInjuryAsync(int injuryId) =>
        _context.InjuryRecoveryPlans
            .Include(p => p.Exercises)
            .Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.InjuryRecordId == injuryId);

    private async Task<InjuryRecoveryPlan> LoadAsync(int planId) =>
        await _context.InjuryRecoveryPlans
            .Include(p => p.Exercises)
            .Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Id == planId)
            ?? throw new NotFoundApiException($"Recovery plan {planId} was not found.");

    private async Task<RecoveryPlanDto> ToDtoAsync(InjuryRecoveryPlan p)
    {
        var player = await _context.Players.FirstOrDefaultAsync(x => x.Id == p.PlayerId);
        var injury = await _context.InjuryRecords.FirstOrDefaultAsync(i => i.Id == p.InjuryRecordId);
        var exercises = p.Exercises ?? new List<RecoveryExercise>();
        return new RecoveryPlanDto
        {
            Id = p.Id,
            InjuryRecordId = p.InjuryRecordId,
            PlayerId = p.PlayerId,
            PlayerName = player?.FullName ?? "",
            CoachId = p.CoachId,
            Title = p.Title,
            EstimatedWeeks = p.EstimatedWeeks,
            CurrentWeek = p.CurrentWeek,
            Status = p.Status,
            Notes = p.Notes,
            CreatedAt = p.CreatedAt,
            InjuryType = injury?.InjuryType ?? "",
            BodyPart = injury?.BodyPart,
            Severity = injury?.Severity ?? InjurySeverity.Minor,
            CompletedExercises = exercises.Count(e => e.IsCompleted),
            TotalExercises = exercises.Count,
            Exercises = exercises
                .OrderBy(e => e.Week).ThenBy(e => e.Id)
                .Select(ToExerciseDto).ToList(),
            Milestones = (p.Milestones ?? new List<RecoveryMilestone>())
                .OrderBy(m => m.TargetWeek).ThenBy(m => m.Id)
                .Select(ToMilestoneDto).ToList(),
        };
    }

    private static RecoveryExerciseDto ToExerciseDto(RecoveryExercise e) => new()
    {
        Id = e.Id,
        InjuryRecoveryPlanId = e.InjuryRecoveryPlanId,
        Title = e.Title,
        Description = e.Description,
        Sets = e.Sets,
        Reps = e.Reps,
        DurationMinutes = e.DurationMinutes,
        RestSeconds = e.RestSeconds,
        Week = e.Week,
        DayOfWeek = e.DayOfWeek,
        Category = e.Category,
        IsCompleted = e.IsCompleted,
        CompletedAt = e.CompletedAt,
        CompletedNote = e.CompletedNote,
        DifficultyRating = e.DifficultyRating,
    };

    private static RecoveryMilestoneDto ToMilestoneDto(RecoveryMilestone m) => new()
    {
        Id = m.Id,
        InjuryRecoveryPlanId = m.InjuryRecoveryPlanId,
        Title = m.Title,
        TargetWeek = m.TargetWeek,
        IsAchieved = m.IsAchieved,
        AchievedAt = m.AchievedAt,
        Notes = m.Notes,
    };
}
