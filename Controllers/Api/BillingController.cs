using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProTracker.Common;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;

namespace ProTracker.Controllers.Api;

[Route("api/billing")]
public class BillingController : ApiControllerBase
{
    private readonly IBillingService _billing;

    public BillingController(IBillingService billing)
    {
        _billing = billing;
    }

    [HttpGet]
    [Authorize(Roles = "Coach,Admin")]
    public async Task<ActionResult> GetInfo() => Success(await _billing.GetInfoAsync(User));

    [HttpPost("checkout")]
    [Authorize(Roles = "Coach")]
    public async Task<ActionResult> Checkout(CheckoutRequestDto dto)
    {
        if (!Enum.TryParse<BillingPlan>(dto.Plan, out var plan))
            throw new ValidationApiException("Unknown plan.");
        var email = User.FindFirstValue(ClaimTypes.Email) ?? "";
        var url = await _billing.CreateCheckoutAsync(User, email, plan);
        return Success(new CheckoutUrlDto { Url = url });
    }

    [HttpPost("portal")]
    [Authorize(Roles = "Coach")]
    public async Task<ActionResult> Portal() => Success(new CheckoutUrlDto { Url = await _billing.CreatePortalAsync(User) });

    // Called by the frontend after the Stripe success redirect so the plan reflects immediately,
    // even when webhooks aren't configured.
    [HttpPost("sync")]
    [Authorize(Roles = "Coach")]
    public async Task<ActionResult> Sync()
    {
        await _billing.SyncAsync(User);
        return Success(await _billing.GetInfoAsync(User));
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook()
    {
        using var reader = new StreamReader(Request.Body);
        var json = await reader.ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();
        await _billing.HandleWebhookAsync(json, signature);
        return Ok();
    }
}
