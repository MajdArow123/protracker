namespace ProTracker.Models;

public enum BillingPlan
{
    Free = 0,
    Pro = 1,
    Team = 2,
}

// One subscription record per coach. Plan drives the backend feature gates; the Stripe* fields
// tie it to the Stripe customer/subscription so webhooks and the billing portal can sync it.
public class CoachSubscription
{
    public int Id { get; set; }

    public string CoachId { get; set; } = "";

    public BillingPlan Plan { get; set; } = BillingPlan.Free;

    // Raw Stripe subscription status (active, trialing, past_due, canceled, …) or null on Free.
    public string? Status { get; set; }

    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// Static per-plan limits/entitlements. null = unlimited.
public record PlanLimits(int? MaxTeams, int? MaxPlayers, bool Ai, bool Pdf, bool ParentPortal, bool PrioritySupport)
{
    public static PlanLimits For(BillingPlan plan) => plan switch
    {
        BillingPlan.Pro => new PlanLimits(null, null, Ai: true, Pdf: true, ParentPortal: false, PrioritySupport: false),
        BillingPlan.Team => new PlanLimits(null, null, Ai: true, Pdf: true, ParentPortal: true, PrioritySupport: true),
        _ => new PlanLimits(MaxTeams: 1, MaxPlayers: 5, Ai: false, Pdf: false, ParentPortal: false, PrioritySupport: false),
    };

    // Monthly price in USD cents (0 for Free) — used for inline Stripe price_data.
    public static long PriceCents(BillingPlan plan) => plan switch
    {
        BillingPlan.Pro => 1900,
        BillingPlan.Team => 4900,
        _ => 0,
    };
}
