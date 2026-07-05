namespace ProTracker.Dtos;

public class PlanLimitsDto
{
    public int? MaxTeams { get; set; }
    public int? MaxPlayers { get; set; }
    public bool Ai { get; set; }
    public bool Pdf { get; set; }
    public bool ParentPortal { get; set; }
    public bool PrioritySupport { get; set; }
}

public class BillingUsageDto
{
    public int Teams { get; set; }
    public int Players { get; set; }
}

public class BillingInfoDto
{
    public string Plan { get; set; } = "Free";
    public string? Status { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public PlanLimitsDto Limits { get; set; } = new();
    public BillingUsageDto Usage { get; set; } = new();
    public bool StripeEnabled { get; set; }
    public string? PublishableKey { get; set; }
    // True once a Stripe customer/subscription exists (so we can show "Manage billing").
    public bool HasStripeCustomer { get; set; }
}

public class CheckoutRequestDto
{
    // "Pro" or "Team".
    public string Plan { get; set; } = "";
}

public class CheckoutUrlDto
{
    public string Url { get; set; } = "";
}
