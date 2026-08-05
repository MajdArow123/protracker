using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IImprovementPlanService
{
    Task<List<ImprovementPlanDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId);
    Task<ImprovementPlanDto> CreateAsync(ClaimsPrincipal user, CreateImprovementPlanDto dto);
    Task<ImprovementPlanDto> UpdateAsync(ClaimsPrincipal user, int id, CreateImprovementPlanDto dto);
}

public class ImprovementPlanService : IImprovementPlanService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly ISeasonStamper _seasons;

    public ImprovementPlanService(ApplicationDbContext context, IAccessControlService access,
        ISeasonStamper seasons)
    {
        _context = context;
        _access = access;
        _seasons = seasons;
    }

    public async Task<List<ImprovementPlanDto>> GetForPlayerAsync(ClaimsPrincipal user, int playerId)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var plans = await _context.ImprovementPlans.Where(p => p.PlayerId == playerId)
            .OrderByDescending(p => p.CreatedDate).ToListAsync();
        return plans.Select(ToDto).ToList();
    }

    public async Task<ImprovementPlanDto> CreateAsync(ClaimsPrincipal user, CreateImprovementPlanDto dto)
    {
        await _access.EnsureCanAccessPlayerAsync(user, dto.PlayerId);

        // A plan has no record date; "today" is the client's local date (S2.2), UTC
        // today as fallback. Player-context stamp; metadata, never blocks (S3).
        var stamp = await _seasons.ForPlayerAsync(dto.PlayerId, ClientLocalDate.ResolveToday(dto.LocalDate));
        var plan = new ImprovementPlan
        {
            PlayerId = dto.PlayerId,
            WeeklyGoals = dto.WeeklyGoals,
            TrainingRecommendations = dto.TrainingRecommendations,
            SkillTargets = dto.SkillTargets,
            SportSpecificDrills = dto.SportSpecificDrills,
            PositionFocus = dto.PositionFocus,
            CoachNotes = dto.CoachNotes,
            SeasonId = stamp.SeasonId,
        };
        _context.ImprovementPlans.Add(plan);
        await _context.SaveChangesAsync();
        var result = ToDto(plan);
        result.SeasonNotice = stamp.Notice;
        return result;
    }

    public async Task<ImprovementPlanDto> UpdateAsync(ClaimsPrincipal user, int id, CreateImprovementPlanDto dto)
    {
        var plan = await _context.ImprovementPlans.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new NotFoundApiException($"Improvement plan {id} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, plan.PlayerId);

        plan.WeeklyGoals = dto.WeeklyGoals;
        plan.TrainingRecommendations = dto.TrainingRecommendations;
        plan.SkillTargets = dto.SkillTargets;
        plan.SportSpecificDrills = dto.SportSpecificDrills;
        plan.PositionFocus = dto.PositionFocus;
        plan.CoachNotes = dto.CoachNotes;
        await _context.SaveChangesAsync();
        return ToDto(plan);
    }

    private static ImprovementPlanDto ToDto(ImprovementPlan p) => new()
    {
        Id = p.Id,
        PlayerId = p.PlayerId,
        CreatedDate = p.CreatedDate,
        WeeklyGoals = p.WeeklyGoals,
        TrainingRecommendations = p.TrainingRecommendations,
        SkillTargets = p.SkillTargets,
        SportSpecificDrills = p.SportSpecificDrills,
        PositionFocus = p.PositionFocus,
        CoachNotes = p.CoachNotes,
        IsAIGenerated = p.IsAIGenerated
    };
}
