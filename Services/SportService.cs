using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;

namespace ProTracker.Services;

public interface ISportService
{
    Task<List<SportDto>> GetAllAsync();
    Task<SportWithDetailsDto> GetByIdAsync(int id);
    Task<List<PositionDto>> GetPositionsAsync(int sportId);
    Task<List<StatCategoryDto>> GetStatCategoriesAsync(int sportId);
}

public class SportService : ISportService
{
    private readonly ApplicationDbContext _context;

    public SportService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SportDto>> GetAllAsync() =>
        await _context.Sports.Select(s => new SportDto
        {
            Id = s.Id,
            Name = s.Name,
            Description = s.Description,
            IconOrImage = s.IconOrImage
        }).ToListAsync();

    public async Task<SportWithDetailsDto> GetByIdAsync(int id)
    {
        var sport = await _context.Sports
            .Include(s => s.Positions)
            .Include(s => s.StatCategories)
            .FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new NotFoundApiException($"Sport {id} was not found.");

        return new SportWithDetailsDto
        {
            Id = sport.Id,
            Name = sport.Name,
            Description = sport.Description,
            IconOrImage = sport.IconOrImage,
            Positions = sport.Positions.Select(p => new PositionDto { Id = p.Id, Name = p.Name, SportId = p.SportId }).ToList(),
            StatCategories = sport.StatCategories.Select(c => new StatCategoryDto { Id = c.Id, Name = c.Name, SportId = c.SportId, Description = c.Description }).ToList()
        };
    }

    public async Task<List<PositionDto>> GetPositionsAsync(int sportId)
    {
        if (!await _context.Sports.AnyAsync(s => s.Id == sportId))
            throw new NotFoundApiException($"Sport {sportId} was not found.");

        return await _context.Positions.Where(p => p.SportId == sportId)
            .Select(p => new PositionDto { Id = p.Id, Name = p.Name, SportId = p.SportId })
            .ToListAsync();
    }

    public async Task<List<StatCategoryDto>> GetStatCategoriesAsync(int sportId)
    {
        if (!await _context.Sports.AnyAsync(s => s.Id == sportId))
            throw new NotFoundApiException($"Sport {sportId} was not found.");

        return await _context.SportStatCategories.Where(c => c.SportId == sportId)
            .Select(c => new StatCategoryDto { Id = c.Id, Name = c.Name, SportId = c.SportId, Description = c.Description })
            .ToListAsync();
    }
}
