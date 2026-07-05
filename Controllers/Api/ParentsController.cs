using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api")]
public class ParentsController : ApiControllerBase
{
    private readonly IParentService _service;

    public ParentsController(IParentService service)
    {
        _service = service;
    }

    // --- Coach: invite & list parents for a player ---

    [HttpPost("parents/invite")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> Invite(CreateParentInviteDto dto) => Created(await _service.InviteAsync(User, dto));

    [HttpGet("players/{playerId}/parents")]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetPlayerParents(int playerId) => Success(await _service.GetPlayerParentsAsync(User, playerId));

    // --- Parent invite acceptance (public) ---

    [HttpGet("parents/validate-invite")]
    [AllowAnonymous]
    public async Task<ActionResult> ValidateInvite([FromQuery] string token) => Success(await _service.ValidateInviteAsync(token));

    [HttpPost("parents/accept-invite")]
    [AllowAnonymous]
    public async Task<ActionResult> AcceptInvite(AcceptParentInviteDto dto)
    {
        await _service.AcceptInviteAsync(dto);
        return Success(new GenericMessageResponse { Message = "Your parent account is ready. You can now sign in." });
    }

    // --- Parent: read-only child views ---

    [HttpGet("parent/children")]
    [Authorize(Roles = "Parent")]
    public async Task<ActionResult> GetChildren() => Success(await _service.GetChildrenAsync(User));

    [HttpGet("parent/children/{playerId}")]
    [Authorize(Roles = "Parent")]
    public async Task<ActionResult> GetChild(int playerId) => Success(await _service.GetChildOverviewAsync(User, playerId));
}
