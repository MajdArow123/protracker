using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public class DrillFilters
{
    public int? SportId { get; set; }
    public DrillCategory? Category { get; set; }
    public DrillDifficulty? Difficulty { get; set; }
    public string? Search { get; set; }
    public bool Favorited { get; set; }
    public bool Mine { get; set; }
    // recommended=true&playerId=X → drills matching the player's weakest assessment areas.
    public bool Recommended { get; set; }
    public int? PlayerId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public interface IDrillService
{
    Task<PagedResult<DrillDto>> ListAsync(ClaimsPrincipal user, DrillFilters filters);
    Task<DrillDto> GetByIdAsync(ClaimsPrincipal user, int id);
    Task<DrillDto> CreateAsync(ClaimsPrincipal user, CreateDrillDto dto);
    Task<DrillDto> UpdateAsync(ClaimsPrincipal user, int id, CreateDrillDto dto);
    Task DeleteAsync(ClaimsPrincipal user, int id);
    Task<bool> ToggleFavoriteAsync(ClaimsPrincipal user, int id);
    Task<List<DrillDto>> GetFavoritesAsync(ClaimsPrincipal user);
    Task<PlayerTaskDto> AssignAsync(ClaimsPrincipal user, int id, AssignDrillDto dto);

    // Weakest assessment category names for a player (weakest first). Used by recommendations.
    Task<List<string>> GetWeakCategoryNamesAsync(int playerId, int count);
    // Full DrillDtos for a set of ids (visible to the caller), preserving the given order.
    Task<List<DrillDto>> GetManyAsync(ClaimsPrincipal user, IEnumerable<int> ids);
}

public class DrillService : IDrillService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IPlayerTaskService _tasks;

    public DrillService(ApplicationDbContext context, IAccessControlService access, IPlayerTaskService tasks)
    {
        _context = context;
        _access = access;
        _tasks = tasks;
    }

    // A drill is visible if it's built-in OR the caller created it.
    private IQueryable<Drill> VisibleDrills(string userId) =>
        _context.Drills.Where(d => d.IsBuiltIn || d.CoachId == userId);

    public async Task<PagedResult<DrillDto>> ListAsync(ClaimsPrincipal user, DrillFilters filters)
    {
        var userId = _access.RequireUserId(user);
        var favIds = await FavoriteIdsAsync(userId);

        // Recommendation mode: drills whose targets match the player's weakest assessment areas.
        if (filters.Recommended && filters.PlayerId is int pid)
            return await RecommendedAsync(user, userId, favIds, pid, filters);

        var query = VisibleDrills(userId);

        if (filters.Mine)
            query = query.Where(d => d.CoachId == userId);
        if (filters.Category.HasValue)
            query = query.Where(d => d.Category == filters.Category.Value);
        if (filters.Difficulty.HasValue)
            query = query.Where(d => d.Difficulty == filters.Difficulty.Value);
        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(s)
                || (d.Description != null && d.Description.ToLower().Contains(s)));
        }
        if (filters.Favorited)
            query = query.Where(d => favIds.Contains(d.Id));

        // Sport filter needs list-membership on the comma-separated column — evaluate in memory
        // after the other (SQL-translatable) filters have narrowed the set.
        var all = await query.OrderByDescending(d => d.IsBuiltIn).ThenBy(d => d.Name).ToListAsync();
        if (filters.SportId is int sportId)
            all = all.Where(d => ParseIds(d.SportIds).Contains(sportId)).ToList();

        var total = all.Count;
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 100);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var sportNames = await SportNamesAsync();
        return new PagedResult<DrillDto>
        {
            Items = items.Select(d => ToDto(d, userId, favIds, sportNames)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize),
        };
    }

    public async Task<DrillDto> GetByIdAsync(ClaimsPrincipal user, int id)
    {
        var userId = _access.RequireUserId(user);
        var drill = await VisibleDrills(userId).FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new NotFoundApiException($"Drill {id} was not found.");
        var favIds = await FavoriteIdsAsync(userId);
        return ToDto(drill, userId, favIds, await SportNamesAsync());
    }

    public async Task<DrillDto> CreateAsync(ClaimsPrincipal user, CreateDrillDto dto)
    {
        var userId = _access.RequireUserId(user);
        Validate(dto);

        var drill = new Drill
        {
            Name = dto.Name.Trim(),
            Description = Trim(dto.Description),
            SportIds = string.Join(",", dto.SportIds.Distinct()),
            Category = dto.Category,
            Difficulty = dto.Difficulty,
            DurationMinutes = dto.DurationMinutes,
            Equipment = Trim(dto.Equipment),
            Instructions = Trim(dto.Instructions),
            VideoUrl = Trim(dto.VideoUrl),
            TargetStatCategories = JoinTags(dto.TargetStatCategories),
            IsBuiltIn = false,
            CoachId = userId,
            CreatedAt = DateTime.UtcNow,
        };
        _context.Drills.Add(drill);
        await _context.SaveChangesAsync();
        return ToDto(drill, userId, new HashSet<int>(), await SportNamesAsync());
    }

    public async Task<DrillDto> UpdateAsync(ClaimsPrincipal user, int id, CreateDrillDto dto)
    {
        var drill = await LoadOwnedAsync(user, id);
        Validate(dto);

        drill.Name = dto.Name.Trim();
        drill.Description = Trim(dto.Description);
        drill.SportIds = string.Join(",", dto.SportIds.Distinct());
        drill.Category = dto.Category;
        drill.Difficulty = dto.Difficulty;
        drill.DurationMinutes = dto.DurationMinutes;
        drill.Equipment = Trim(dto.Equipment);
        drill.Instructions = Trim(dto.Instructions);
        drill.VideoUrl = Trim(dto.VideoUrl);
        drill.TargetStatCategories = JoinTags(dto.TargetStatCategories);
        await _context.SaveChangesAsync();

        var userId = _access.RequireUserId(user);
        var favIds = await FavoriteIdsAsync(userId);
        return ToDto(drill, userId, favIds, await SportNamesAsync());
    }

    public async Task DeleteAsync(ClaimsPrincipal user, int id)
    {
        var drill = await LoadOwnedAsync(user, id);
        _context.Drills.Remove(drill);
        await _context.SaveChangesAsync();
    }

    public async Task<bool> ToggleFavoriteAsync(ClaimsPrincipal user, int id)
    {
        var userId = _access.RequireUserId(user);
        // Only favorite a drill the user can actually see.
        var exists = await VisibleDrills(userId).AnyAsync(d => d.Id == id);
        if (!exists) throw new NotFoundApiException($"Drill {id} was not found.");

        var fav = await _context.DrillFavorites.FirstOrDefaultAsync(f => f.DrillId == id && f.UserId == userId);
        if (fav != null)
        {
            _context.DrillFavorites.Remove(fav);
            await _context.SaveChangesAsync();
            return false;
        }
        _context.DrillFavorites.Add(new DrillFavorite { DrillId = id, UserId = userId, CreatedAt = DateTime.UtcNow });
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<DrillDto>> GetFavoritesAsync(ClaimsPrincipal user)
    {
        var userId = _access.RequireUserId(user);
        var favIds = await FavoriteIdsAsync(userId);
        var drills = await VisibleDrills(userId).Where(d => favIds.Contains(d.Id)).ToListAsync();
        var sportNames = await SportNamesAsync();
        return drills.OrderBy(d => d.Name).Select(d => ToDto(d, userId, favIds, sportNames)).ToList();
    }

    public async Task<PlayerTaskDto> AssignAsync(ClaimsPrincipal user, int id, AssignDrillDto dto)
    {
        var userId = _access.RequireUserId(user);
        var drill = await VisibleDrills(userId).FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new NotFoundApiException($"Drill {id} was not found.");

        var description = string.IsNullOrWhiteSpace(dto.Note)
            ? drill.Instructions
            : $"{dto.Note!.Trim()}\n\n{drill.Instructions}".Trim();

        // Access enforcement (coach owns team / solo owns self) happens inside the task service.
        return await _tasks.CreateAsync(user, new CreatePlayerTaskDto
        {
            PlayerId = dto.PlayerId,
            Title = drill.Name,
            Description = description,
            DueDate = dto.DueDate,
            Priority = dto.Priority,
            Category = MapCategory(drill.Category),
        });
    }

    public async Task<List<string>> GetWeakCategoryNamesAsync(int playerId, int count)
    {
        var latest = await _context.PlayerAssessments
            .Include(a => a.StatScores).ThenInclude(s => s.SportStatCategory)
            .Where(a => a.PlayerId == playerId)
            .OrderByDescending(a => a.DateRecorded)
            .FirstOrDefaultAsync();
        if (latest == null) return new();
        return latest.StatScores
            .OrderBy(s => s.Score)
            .Take(count)
            .Select(s => s.SportStatCategory.Name)
            .ToList();
    }

    public async Task<List<DrillDto>> GetManyAsync(ClaimsPrincipal user, IEnumerable<int> ids)
    {
        var userId = _access.RequireUserId(user);
        var idList = ids.ToList();
        var favIds = await FavoriteIdsAsync(userId);
        var sportNames = await SportNamesAsync();
        var drills = await VisibleDrills(userId).Where(d => idList.Contains(d.Id)).ToListAsync();
        // Preserve the requested order.
        return idList
            .Select(id => drills.FirstOrDefault(d => d.Id == id))
            .Where(d => d != null)
            .Select(d => ToDto(d!, userId, favIds, sportNames))
            .ToList();
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    // Category-match recommendations (no AI): drills for the player's sport whose targets
    // hit their weakest assessment areas, weakest area first.
    private async Task<PagedResult<DrillDto>> RecommendedAsync(
        ClaimsPrincipal user, string userId, HashSet<int> favIds, int playerId, DrillFilters filters)
    {
        await _access.EnsureCanAccessPlayerAsync(user, playerId);
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId)
            ?? throw new NotFoundApiException($"Player {playerId} was not found.");

        var weak = await GetWeakCategoryNamesAsync(playerId, 3);
        // Rank of a category name (0 = weakest); lower is more relevant.
        int Rank(string name)
        {
            var i = weak.FindIndex(w => string.Equals(w, name, StringComparison.OrdinalIgnoreCase));
            return i < 0 ? int.MaxValue : i;
        }

        var sportNames = await SportNamesAsync();
        var candidates = (await VisibleDrills(userId).ToListAsync())
            .Where(d => ParseIds(d.SportIds).Contains(player.SportId))
            .ToList();

        // Best (lowest) weak-rank each drill hits.
        var scored = candidates
            .Select(d => new { Drill = d, Targets = ParseTags(d.TargetStatCategories) })
            .Select(x => new { x.Drill, Best = x.Targets.Select(Rank).DefaultIfEmpty(int.MaxValue).Min(), x.Targets })
            .Where(x => weak.Count == 0 || x.Best != int.MaxValue) // matched a weak area (if any exist)
            .OrderBy(x => x.Best)
            .ThenBy(x => x.Drill.Name)
            .ToList();

        var total = scored.Count;
        var page = Math.Max(1, filters.Page);
        var pageSize = Math.Clamp(filters.PageSize, 1, 100);
        var items = scored.Skip((page - 1) * pageSize).Take(pageSize).Select(x =>
        {
            var dto = ToDto(x.Drill, userId, favIds, sportNames);
            dto.RecommendTarget = x.Best == int.MaxValue ? null : weak[x.Best];
            return dto;
        }).ToList();

        return new PagedResult<DrillDto>
        {
            Items = items, Page = page, PageSize = pageSize,
            TotalCount = total, TotalPages = (int)Math.Ceiling(total / (double)pageSize),
        };
    }

    private async Task<Drill> LoadOwnedAsync(ClaimsPrincipal user, int id)
    {
        var drill = await _context.Drills.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new NotFoundApiException($"Drill {id} was not found.");
        if (drill.IsBuiltIn)
            throw new ForbiddenApiException("Built-in drills cannot be modified.");
        if (!user.IsInRole("Admin"))
        {
            var userId = _access.RequireUserId(user);
            if (drill.CoachId != userId)
                throw new ForbiddenApiException("You can only modify drills you created.");
        }
        return drill;
    }

    private async Task<HashSet<int>> FavoriteIdsAsync(string userId) =>
        (await _context.DrillFavorites.Where(f => f.UserId == userId).Select(f => f.DrillId).ToListAsync()).ToHashSet();

    private async Task<Dictionary<int, string>> SportNamesAsync() =>
        await _context.Sports.ToDictionaryAsync(s => s.Id, s => s.Name);

    private static void Validate(CreateDrillDto dto)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(dto.Name)) errors.Add("A drill name is required.");
        if (dto.SportIds.Count == 0) errors.Add("Select at least one sport.");
        if (errors.Count > 0) throw new ValidationApiException(errors);
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string? JoinTags(List<string> tags)
    {
        var clean = tags.Select(t => t.Trim()).Where(t => t.Length > 0).Distinct().ToList();
        return clean.Count == 0 ? null : string.Join(",", clean);
    }

    private static List<int> ParseIds(string csv) =>
        csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
           .Select(x => int.TryParse(x, out var n) ? n : (int?)null)
           .Where(n => n != null).Select(n => n!.Value).ToList();

    private static List<string> ParseTags(string? csv) =>
        string.IsNullOrWhiteSpace(csv) ? new()
        : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    // Drill category → the assignable task category.
    public static TaskCategory MapCategory(DrillCategory c) => c switch
    {
        DrillCategory.Technical => TaskCategory.Training,
        DrillCategory.Tactical => TaskCategory.Tactical,
        DrillCategory.Recovery => TaskCategory.Recovery,
        DrillCategory.Cooldown => TaskCategory.Recovery,
        DrillCategory.Mental => TaskCategory.Other,
        _ => TaskCategory.Physical, // WarmUp / Fitness / Strength / Speed / Agility
    };

    private static DrillDto ToDto(Drill d, string userId, HashSet<int> favIds, IReadOnlyDictionary<int, string> sportNames)
    {
        var ids = ParseIds(d.SportIds);
        return new DrillDto
        {
            Id = d.Id,
            Name = d.Name,
            Description = d.Description,
            SportIds = ids,
            SportNames = ids.Select(i => sportNames.TryGetValue(i, out var n) ? n : "").Where(n => n.Length > 0).ToList(),
            Category = d.Category,
            Difficulty = d.Difficulty,
            DurationMinutes = d.DurationMinutes,
            Equipment = d.Equipment,
            Instructions = d.Instructions,
            VideoUrl = d.VideoUrl,
            TargetStatCategories = ParseTags(d.TargetStatCategories),
            IsBuiltIn = d.IsBuiltIn,
            IsCustom = d.CoachId == userId,
            IsFavorited = favIds.Contains(d.Id),
            CreatedAt = d.CreatedAt,
        };
    }
}
