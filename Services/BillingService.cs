using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ProTracker.Common;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using Stripe;
using Stripe.Checkout;

namespace ProTracker.Services;

public interface IBillingService
{
    bool StripeEnabled { get; }
    string? PublishableKey { get; }

    Task<CoachSubscription> GetOrCreateAsync(string coachId);
    Task<BillingInfoDto> GetInfoAsync(ClaimsPrincipal user);

    Task EnsureCanCreateTeamAsync(ClaimsPrincipal user);
    Task EnsureCanAddPlayerAsync(ClaimsPrincipal user);
    Task EnsureAiAllowedAsync(ClaimsPrincipal user);
    Task EnsureParentPortalAllowedAsync(ClaimsPrincipal user);

    Task<string> CreateCheckoutAsync(ClaimsPrincipal user, string email, BillingPlan plan);
    Task<string> CreatePortalAsync(ClaimsPrincipal user);
    Task SyncAsync(ClaimsPrincipal user);
    Task HandleWebhookAsync(string json, string? signature);
}

public class BillingService : IBillingService
{
    private readonly ApplicationDbContext _context;
    private readonly IAccessControlService _access;
    private readonly IConfiguration _config;
    private readonly ILogger<BillingService> _logger;

    public BillingService(ApplicationDbContext context, IAccessControlService access, IConfiguration config, ILogger<BillingService> logger)
    {
        _context = context;
        _access = access;
        _config = config;
        _logger = logger;
    }

    public bool StripeEnabled => !string.IsNullOrWhiteSpace(_config["Stripe:SecretKey"]);
    public string? PublishableKey => _config["Stripe:PublishableKey"];
    private string FrontendUrl => (_config["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');

    public async Task<CoachSubscription> GetOrCreateAsync(string coachId)
    {
        var sub = await _context.CoachSubscriptions.FirstOrDefaultAsync(s => s.CoachId == coachId);
        if (sub == null)
        {
            sub = new CoachSubscription { CoachId = coachId, Plan = BillingPlan.Free };
            _context.CoachSubscriptions.Add(sub);
            await _context.SaveChangesAsync();
        }
        return sub;
    }

    private async Task<BillingPlan> GetPlanAsync(ClaimsPrincipal user)
    {
        if (user.IsInRole("Admin")) return BillingPlan.Team; // admins are unrestricted
        var coachId = _access.RequireUserId(user);
        return (await GetOrCreateAsync(coachId)).Plan;
    }

    public async Task<BillingInfoDto> GetInfoAsync(ClaimsPrincipal user)
    {
        var coachId = _access.RequireUserId(user);
        var sub = await GetOrCreateAsync(coachId);
        var limits = PlanLimits.For(sub.Plan);
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var players = teamIds.Count == 0 ? 0 : await _context.Players.CountAsync(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value));

        return new BillingInfoDto
        {
            Plan = sub.Plan.ToString(),
            Status = sub.Status,
            CurrentPeriodEnd = sub.CurrentPeriodEnd,
            StripeEnabled = StripeEnabled,
            PublishableKey = PublishableKey,
            HasStripeCustomer = !string.IsNullOrEmpty(sub.StripeCustomerId),
            Limits = new PlanLimitsDto
            {
                MaxTeams = limits.MaxTeams, MaxPlayers = limits.MaxPlayers,
                Ai = limits.Ai, Pdf = limits.Pdf, ParentPortal = limits.ParentPortal, PrioritySupport = limits.PrioritySupport,
            },
            Usage = new BillingUsageDto { Teams = teamIds.Count, Players = players },
        };
    }

    // --- Feature gates (backend enforcement) ---

    public async Task EnsureCanCreateTeamAsync(ClaimsPrincipal user)
    {
        if (user.IsInRole("Admin")) return;
        var coachId = _access.RequireUserId(user);
        var plan = (await GetOrCreateAsync(coachId)).Plan;
        var max = PlanLimits.For(plan).MaxTeams;
        if (max == null) return;
        var count = await _context.CoachTeamScopes.CountAsync(s => s.CoachId == coachId);
        if (count >= max)
            throw new PlanLimitApiException($"Your Free plan is limited to {max} team. Upgrade to Pro for unlimited teams.");
    }

    public async Task EnsureCanAddPlayerAsync(ClaimsPrincipal user)
    {
        if (user.IsInRole("Admin")) return;
        var plan = await GetPlanAsync(user);
        var max = PlanLimits.For(plan).MaxPlayers;
        if (max == null) return;
        var teamIds = await _access.GetAccessibleTeamIdsAsync(user);
        var count = teamIds.Count == 0 ? 0 : await _context.Players.CountAsync(p => p.TeamId != null && teamIds.Contains(p.TeamId.Value));
        if (count >= max)
            throw new PlanLimitApiException($"Your Free plan is limited to {max} players. Upgrade to Pro for unlimited players.");
    }

    public async Task EnsureAiAllowedAsync(ClaimsPrincipal user)
    {
        // Solo athletes get AI on any plan: the coach plan limits (team/player counts)
        // don't map onto a single self-managed athlete, and AI nutrition/recovery is the
        // core of the solo product. Revisit if a paid solo tier is introduced.
        if (_access.IsSoloAthlete(user)) return;
        if (!PlanLimits.For(await GetPlanAsync(user)).Ai)
            throw new PlanLimitApiException("AI features are available on the Pro and Team plans. Upgrade to unlock them.");
    }

    public async Task EnsureParentPortalAllowedAsync(ClaimsPrincipal user)
    {
        if (!PlanLimits.For(await GetPlanAsync(user)).ParentPortal)
            throw new PlanLimitApiException("The parent portal is available on the Team plan. Upgrade to invite parents.");
    }

    // --- Stripe ---

    private void RequireStripe()
    {
        if (!StripeEnabled)
            throw new ValidationApiException("Billing isn't configured on this deployment yet.");
        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
    }

    public async Task<string> CreateCheckoutAsync(ClaimsPrincipal user, string email, BillingPlan plan)
    {
        RequireStripe();
        if (plan == BillingPlan.Free)
            throw new ValidationApiException("Choose the Pro or Team plan to check out.");

        var coachId = _access.RequireUserId(user);
        var sub = await GetOrCreateAsync(coachId);

        if (string.IsNullOrEmpty(sub.StripeCustomerId))
        {
            var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
            {
                Email = email,
                Metadata = new Dictionary<string, string> { ["coachId"] = coachId },
            });
            sub.StripeCustomerId = customer.Id;
            await _context.SaveChangesAsync();
        }

        var session = await new SessionService().CreateAsync(new SessionCreateOptions
        {
            Mode = "subscription",
            Customer = sub.StripeCustomerId,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "usd",
                        UnitAmount = PlanLimits.PriceCents(plan),
                        Recurring = new SessionLineItemPriceDataRecurringOptions { Interval = "month" },
                        ProductData = new SessionLineItemPriceDataProductDataOptions { Name = $"ProTracker {plan} plan" },
                    },
                },
            },
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string> { ["coachId"] = coachId, ["plan"] = plan.ToString() },
            },
            Metadata = new Dictionary<string, string> { ["coachId"] = coachId, ["plan"] = plan.ToString() },
            SuccessUrl = $"{FrontendUrl}/settings/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{FrontendUrl}/settings/billing?status=cancel",
        });

        return session.Url;
    }

    public async Task<string> CreatePortalAsync(ClaimsPrincipal user)
    {
        RequireStripe();
        var coachId = _access.RequireUserId(user);
        var sub = await GetOrCreateAsync(coachId);
        if (string.IsNullOrEmpty(sub.StripeCustomerId))
            throw new ValidationApiException("No billing account yet — subscribe to a paid plan first.");

        var session = await new Stripe.BillingPortal.SessionService().CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = sub.StripeCustomerId,
            ReturnUrl = $"{FrontendUrl}/settings/billing",
        });
        return session.Url;
    }

    // Pull the customer's current subscription from Stripe and reconcile the DB. Called after the
    // checkout success redirect so it works even if webhooks aren't wired up.
    public async Task SyncAsync(ClaimsPrincipal user)
    {
        if (!StripeEnabled) return;
        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];
        var coachId = _access.RequireUserId(user);
        var sub = await GetOrCreateAsync(coachId);
        if (string.IsNullOrEmpty(sub.StripeCustomerId)) return;

        var list = await new SubscriptionService().ListAsync(new SubscriptionListOptions
        {
            Customer = sub.StripeCustomerId,
            Status = "all",
            Limit = 10,
        });
        ApplyStripeSubscription(sub, list.Data
            .OrderByDescending(s => s.Created)
            .FirstOrDefault(s => s.Status is "active" or "trialing"));
        await _context.SaveChangesAsync();
    }

    public async Task HandleWebhookAsync(string json, string? signature)
    {
        var secret = _config["Stripe:WebhookSecret"];
        Event stripeEvent;
        try
        {
            stripeEvent = !string.IsNullOrWhiteSpace(secret) && !string.IsNullOrEmpty(signature)
                ? EventUtility.ConstructEvent(json, signature, secret)
                : EventUtility.ParseEvent(json);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "[Billing] Webhook signature verification failed.");
            throw new ValidationApiException("Invalid webhook signature.");
        }

        StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];

        switch (stripeEvent.Type)
        {
            case "customer.subscription.updated":
            case "customer.subscription.created":
            case "customer.subscription.deleted":
            {
                if (stripeEvent.Data.Object is Subscription s)
                    await ReconcileByCustomerAsync(s.CustomerId, s);
                break;
            }
            case "checkout.session.completed":
            {
                if (stripeEvent.Data.Object is Session session && !string.IsNullOrEmpty(session.CustomerId))
                {
                    var subs = await new SubscriptionService().ListAsync(new SubscriptionListOptions { Customer = session.CustomerId, Status = "all", Limit = 10 });
                    await ReconcileByCustomerAsync(session.CustomerId,
                        subs.Data.OrderByDescending(x => x.Created).FirstOrDefault(x => x.Status is "active" or "trialing"));
                }
                break;
            }
        }
    }

    private async Task ReconcileByCustomerAsync(string customerId, Subscription? sub)
    {
        var record = await _context.CoachSubscriptions.FirstOrDefaultAsync(s => s.StripeCustomerId == customerId);
        if (record == null) return;
        ApplyStripeSubscription(record, sub);
        await _context.SaveChangesAsync();
    }

    private static void ApplyStripeSubscription(CoachSubscription record, Subscription? sub)
    {
        record.UpdatedAt = DateTime.UtcNow;
        if (sub == null || sub.Status is "canceled" or "incomplete_expired")
        {
            record.Plan = BillingPlan.Free;
            record.Status = sub?.Status ?? "canceled";
            record.StripeSubscriptionId = null;
            record.CurrentPeriodEnd = null;
            return;
        }

        record.StripeSubscriptionId = sub.Id;
        record.Status = sub.Status;
        record.CurrentPeriodEnd = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        if (sub.Metadata != null && sub.Metadata.TryGetValue("plan", out var planStr) && Enum.TryParse<BillingPlan>(planStr, out var plan))
            record.Plan = plan;
    }
}
