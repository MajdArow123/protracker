using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IStatScoreService
{
    Task<List<PlayerStatScoreDto>> GetForAssessmentAsync(ClaimsPrincipal user, int assessmentId);
    Task<PlayerStatScoreDto> CreateAsync(ClaimsPrincipal user, CreatePlayerStatScoreDto dto);
    Task<PlayerStatScoreDto> UpdateAsync(ClaimsPrincipal user, int id, CreatePlayerStatScoreDto dto);
}

public class StatScoreService : IStatScoreService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public StatScoreService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<PlayerStatScoreDto>> GetForAssessmentAsync(ClaimsPrincipal user, int assessmentId)
    {
        var assessment = await _context.PlayerAssessments.FirstOrDefaultAsync(a => a.Id == assessmentId)
            ?? throw new NotFoundApiException($"Assessment {assessmentId} was not found.");
        await _access.EnsureCanAccessPlayerAsync(user, assessment.PlayerId);

        var scores = await _context.PlayerStatScores
            .Include(s => s.SportStatCategory)
            .Where(s => s.PlayerAssessmentId == assessmentId)
            .ToListAsync();

        return scores.Select(ToDto).ToList();
    }

    public async Task<PlayerStatScoreDto> CreateAsync(ClaimsPrincipal user, CreatePlayerStatScoreDto dto)
    {
        var assessment = await _context.PlayerAssessments.FirstOrDefaultAsync(a => a.Id == dto.PlayerAssessmentId)
            ?? throw new ValidationApiException($"Assessment {dto.PlayerAssessmentId} does not exist.");
        await _access.EnsureCanAccessPlayerAsync(user, assessment.PlayerId);

        var score = new PlayerStatScore
        {
            PlayerAssessmentId = dto.PlayerAssessmentId,
            SportStatCategoryId = dto.SportStatCategoryId,
            Score = dto.Score
        };
        _context.PlayerStatScores.Add(score);
        await _context.SaveChangesAsync();

        await _context.Entry(score).Reference(s => s.SportStatCategory).LoadAsync();
        return ToDto(score);
    }

    public async Task<PlayerStatScoreDto> UpdateAsync(ClaimsPrincipal user, int id, CreatePlayerStatScoreDto dto)
    {
        var score = await _context.PlayerStatScores
            .Include(s => s.PlayerAssessment)
            .Include(s => s.SportStatCategory)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundApiException($"Stat score {id} was not found.");

        await _access.EnsureCanAccessPlayerAsync(user, score.PlayerAssessment.PlayerId);

        score.Score = dto.Score;
        score.SportStatCategoryId = dto.SportStatCategoryId;
        await _context.SaveChangesAsync();
        await _context.Entry(score).Reference(s => s.SportStatCategory).LoadAsync();

        return ToDto(score);
    }

    private static PlayerStatScoreDto ToDto(PlayerStatScore s) => new()
    {
        Id = s.Id,
        PlayerAssessmentId = s.PlayerAssessmentId,
        SportStatCategoryId = s.SportStatCategoryId,
        StatCategoryName = s.SportStatCategory?.Name ?? "",
        Score = s.Score
    };
}
