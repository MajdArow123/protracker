using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

public class UsersController : ApiControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> GetAll() => Success(await _userService.GetAllAsync());

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(string id)
    {
        EnsureSelfOrAdmin(id);
        return Success(await _userService.GetByIdAsync(id));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(string id, UserUpdateDto dto)
    {
        EnsureSelfOrAdmin(id);
        return Success(await _userService.UpdateAsync(id, dto));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Delete(string id)
    {
        await _userService.DeleteAsync(id);
        return NoContentSuccess();
    }

    private void EnsureSelfOrAdmin(string id)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!User.IsInRole("Admin") && currentUserId != id)
            throw new ForbiddenApiException("You can only access your own user record.");
    }
}
