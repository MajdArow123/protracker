using Microsoft.AspNetCore.Identity;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Models;

namespace ProTracker.Services;

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync();
    Task<UserDto> GetByIdAsync(string id);
    Task<UserDto> UpdateAsync(string id, UserUpdateDto dto);
    Task DeleteAsync(string id);
}

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public UserService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<List<UserDto>> GetAllAsync()
    {
        var users = _userManager.Users.ToList();
        var result = new List<UserDto>();
        foreach (var user in users)
            result.Add(await ToDtoAsync(user));
        return result;
    }

    public async Task<UserDto> GetByIdAsync(string id)
    {
        var user = await _userManager.FindByIdAsync(id) ?? throw new NotFoundApiException($"User {id} was not found.");
        return await ToDtoAsync(user);
    }

    public async Task<UserDto> UpdateAsync(string id, UserUpdateDto dto)
    {
        var user = await _userManager.FindByIdAsync(id) ?? throw new NotFoundApiException($"User {id} was not found.");
        user.DisplayName = dto.DisplayName;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new ValidationApiException(result.Errors.Select(e => e.Description));
        return await ToDtoAsync(user);
    }

    public async Task DeleteAsync(string id)
    {
        var user = await _userManager.FindByIdAsync(id) ?? throw new NotFoundApiException($"User {id} was not found.");
        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
            throw new ValidationApiException(result.Errors.Select(e => e.Description));
    }

    private async Task<UserDto> ToDtoAsync(ApplicationUser user) => new()
    {
        Id = user.Id,
        Email = user.Email ?? "",
        DisplayName = user.DisplayName,
        Roles = (await _userManager.GetRolesAsync(user)).ToList()
    };
}
