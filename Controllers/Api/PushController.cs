using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Dtos;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/push")]
public class PushController : ApiControllerBase
{
    private readonly IPushService _push;
    private readonly IAccessControlService _access;

    public PushController(IPushService push, IAccessControlService access)
    {
        _push = push;
        _access = access;
    }

    // The VAPID public key the browser needs to subscribe. Public — no secret here.
    [HttpGet("vapid-public-key")]
    [AllowAnonymous]
    public ActionResult GetPublicKey() => Success(new { publicKey = _push.PublicKey, enabled = _push.IsConfigured });

    [HttpPost("subscribe")]
    public async Task<ActionResult> Subscribe(SavePushSubscriptionDto dto)
    {
        await _push.SaveSubscriptionAsync(_access.RequireUserId(User), dto);
        return NoContentSuccess();
    }

    [HttpPost("unsubscribe")]
    public async Task<ActionResult> Unsubscribe(UnsubscribeDto dto)
    {
        await _push.RemoveSubscriptionAsync(_access.RequireUserId(User), dto.Endpoint);
        return NoContentSuccess();
    }
}
