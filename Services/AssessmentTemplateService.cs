using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IAssessmentTemplateService
{
    Task<List<AssessmentTemplateDto>> ListAsync(ClaimsPrincipal user, int? sportId);
    Task<AssessmentTemplateDto> CreateAsync(ClaimsPrincipal user, CreateAssessmentTemplateDto dto);
    Task<AssessmentTemplateDto> UpdateAsync(ClaimsPrincipal user, int id, CreateAssessmentTemplateDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<AppliedTemplateDto> ApplyAsync(ClaimsPrincipal user, int id, int playerId);
}

public class AssessmentTemplateService : IAssessmentTemplateService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;

    public AssessmentTemplateService(ApplicationDbContext context, IAccessControlService access)
    {
        _context = context;
        _access = access;
    }

    public async Task<List<AssessmentTemplateDto>> ListAsync(ClaimsPrincipal user, int? sportId)
    {
        var userId = _access.RequireUserId(user);
        var query = _context.AssessmentTemplates.Include(t => t.Scores).Include(t => t.Sport).Where(t => t.CoachId == userId);
        if (sportId is int sid) query = query.Where(t => t.SportId == sid);

        var templates = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        var names = await CategoryNamesAsync();
        return templates.Select(t => ToDto(t, names)).ToList();
    }

    public async Task<AssessmentTemplateDto> CreateAsync(ClaimsPrincipal user, CreateAssessmentTemplateDto dto)
    {
        var userId = _access.RequireUserId(user);
        await ValidateAsync(dto);

        var template = new AssessmentTemplate
        {
            CoachId = userId,
            Name = dto.Name.Trim(),
            Description = Trim(dto.Description),
            SportId = dto.SportId,
            DefaultNotes = Trim(dto.DefaultNotes),
            CreatedAt = DateTime.UtcNow,
            Scores = dto.Scores.Select(ToScore).ToList(),
        };
        _context.AssessmentTemplates.Add(template);
        await _context.SaveChangesAsync();
        await _context.Entry(template).Reference(t => t.Sport).LoadAsync();
        return ToDto(template, await CategoryNamesAsync());
    }

    public async Task<AssessmentTemplateDto> UpdateAsync(ClaimsPrincipal user, int id, CreateAssessmentTemplateDto dto)
    {
        var template = await LoadOwnedAsync(user, id);
        await ValidateAsync(dto);

        template.Name = dto.Name.Trim();
        template.Description = Trim(dto.Description);
        template.SportId = dto.SportId;
        template.DefaultNotes = Trim(dto.DefaultNotes);
        // Replace the score set.
        _context.AssessmentTemplateScores.RemoveRange(template.Scores);
        template.Scores = dto.Scores.Select(ToScore).ToList();
        await _context.SaveChangesAsync();
        return ToDto(template, await CategoryNamesAsync());
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var template = await LoadOwnedAsync(user, id);
        _context.AssessmentTemplates.Remove(template);
        await _context.SaveChangesAsync();
    }

    public async Task<AppliedTemplateDto> ApplyAsync(ClaimsPrincipal user, int id, int playerId)
    {
        var template = await LoadOwnedAsync(user, id);
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var player = await _context.Players.FirstAsync(p => p.Id == playerId);
        if (player.SportId != template.SportId)
            throw new ValidationApiException("This template is for a different sport than the player.");

        var names = await CategoryNamesAsync();
        return new AppliedTemplateDto
        {
            TemplateId = template.Id,
            TemplateName = template.Name,
            PlayerId = playerId,
            DefaultNotes = template.DefaultNotes,
            Scores = template.Scores.Select(s => ToScoreDto(s, names)).ToList(),
        };
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private async Task<AssessmentTemplate> LoadOwnedAsync(ClaimsPrincipal user, int id)
    {
        var template = await _context.AssessmentTemplates.Include(t => t.Scores).Include(t => t.Sport).FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new NotFoundApiException($"Template {id} was not found.");
        if (!user.IsInRole("Admin"))
        {
            var userId = _access.RequireUserId(user);
            if (template.CoachId != userId)
                throw new ForbiddenApiException("You can only manage templates you created.");
        }
        return template;
    }

    private async Task ValidateAsync(CreateAssessmentTemplateDto dto)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(dto.Name)) errors.Add("A template name is required.");
        if (dto.SportId <= 0) errors.Add("A sport is required.");
        if (errors.Count > 0) throw new ValidationApiException(errors);

        // Every referenced category must belong to the template's sport.
        var validIds = await _context.SportStatCategories.Where(c => c.SportId == dto.SportId).Select(c => c.Id).ToListAsync();
        var invalid = dto.Scores.Select(s => s.SportStatCategoryId).Where(cid => !validIds.Contains(cid)).ToList();
        if (invalid.Count > 0)
            throw new ValidationApiException("A category does not belong to the selected sport.");
    }

    private static AssessmentTemplateScore ToScore(CreateAssessmentTemplateScoreDto s) => new()
    {
        SportStatCategoryId = s.SportStatCategoryId,
        DefaultScore = s.DefaultScore,
        Weight = s.Weight,
        IsRequired = s.IsRequired,
    };

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private async Task<Dictionary<int, string>> CategoryNamesAsync() =>
        await _context.SportStatCategories.ToDictionaryAsync(c => c.Id, c => c.Name);

    private static AssessmentTemplateScoreDto ToScoreDto(AssessmentTemplateScore s, IReadOnlyDictionary<int, string> names) => new()
    {
        SportStatCategoryId = s.SportStatCategoryId,
        CategoryName = names.TryGetValue(s.SportStatCategoryId, out var n) ? n : "",
        DefaultScore = s.DefaultScore,
        Weight = s.Weight,
        IsRequired = s.IsRequired,
    };

    private static AssessmentTemplateDto ToDto(AssessmentTemplate t, IReadOnlyDictionary<int, string> names) => new()
    {
        Id = t.Id,
        CoachId = t.CoachId,
        Name = t.Name,
        Description = t.Description,
        SportId = t.SportId,
        SportName = t.Sport?.Name ?? "",
        DefaultNotes = t.DefaultNotes,
        CreatedAt = t.CreatedAt,
        Scores = t.Scores.Select(s => ToScoreDto(s, names)).ToList(),
    };
}
