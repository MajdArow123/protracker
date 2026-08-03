// --- Billing ---
export type BillingPlanName = 'Free' | 'Pro' | 'Team';

export interface BillingLimits {
  maxTeams: number | null;
  maxPlayers: number | null;
  ai: boolean;
  pdf: boolean;
  parentPortal: boolean;
  prioritySupport: boolean;
}

export interface BillingInfo {
  plan: BillingPlanName;
  status?: string | null;
  currentPeriodEnd?: string | null;
  limits: BillingLimits;
  usage: { teams: number; players: number };
  stripeEnabled: boolean;
  publishableKey?: string | null;
  hasStripeCustomer: boolean;
}
