using Microsoft.AspNetCore.Mvc.Filters;
using ProTracker.Services;

namespace ProTracker.Filters;

// Every AI endpoint requires a plan with AI enabled (Pro/Team; solo athletes bypass —
// see BillingService.EnsureAiAllowedAsync). Applied explicitly on each AI controller
// class so a new AI controller must opt in; AiBillingGateTests pins the gate on every
// existing endpoint.
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AiBillingGateAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var billing = context.HttpContext.RequestServices.GetRequiredService<IBillingService>();
        await billing.EnsureAiAllowedAsync(context.HttpContext.User);
        await next();
    }
}
