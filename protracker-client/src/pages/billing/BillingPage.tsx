import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, Sparkles, Zap, Crown, CreditCard, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { useBilling } from '../../hooks/useBilling';
import { billingApi } from '../../api/billingApi';
import { useToast } from '../../context/ToastContext';
import type { BillingPlanName } from '../../types';

interface PlanCard {
  name: BillingPlanName;
  price: string;
  tagline: string;
  icon: typeof Zap;
  accent: string;
  features: { label: string; included: boolean }[];
}

const PLANS: PlanCard[] = [
  {
    name: 'Free', price: '$0', tagline: 'Get started', icon: Zap, accent: 'text-gray-500',
    features: [
      { label: '1 team', included: true },
      { label: 'Up to 5 players', included: true },
      { label: 'Assessments & reports', included: true },
      { label: 'AI features', included: false },
      { label: 'PDF export', included: false },
      { label: 'Parent portal', included: false },
    ],
  },
  {
    name: 'Pro', price: '$19', tagline: 'For growing squads', icon: Sparkles, accent: 'text-indigo-500',
    features: [
      { label: 'Unlimited teams', included: true },
      { label: 'Unlimited players', included: true },
      { label: 'All AI features', included: true },
      { label: 'PDF export', included: true },
      { label: 'Assessments & reports', included: true },
      { label: 'Parent portal', included: false },
    ],
  },
  {
    name: 'Team', price: '$49', tagline: 'For clubs & academies', icon: Crown, accent: 'text-amber-500',
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'Unlimited teams & players', included: true },
      { label: 'All AI features + PDF export', included: true },
      { label: 'Parent portal', included: true },
      { label: 'Priority support', included: true },
    ],
  },
];

const RANK: Record<BillingPlanName, number> = { Free: 0, Pro: 1, Team: 2 };

export function BillingPage() {
  const { data: billing, isLoading, isError, refetch } = useBilling();
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<BillingPlanName | 'portal' | null>(null);

  // Handle the Stripe checkout return: sync the plan from Stripe, then clean the URL.
  useEffect(() => {
    const status = params.get('status');
    if (!status) return;
    (async () => {
      if (status === 'success') {
        try {
          await billingApi.sync();
          qc.invalidateQueries({ queryKey: ['billing'] });
          addToast('Subscription active — thanks for upgrading!', 'success');
        } catch {
          addToast('Payment received — your plan will update shortly.', 'info');
        }
      } else if (status === 'cancel') {
        addToast('Checkout canceled.', 'info');
      }
      setParams({}, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <PageWrapper title="Billing & Plan"><DashboardSkeleton /></PageWrapper>;
  if (isError || !billing) return <PageWrapper title="Billing & Plan"><ErrorState onRetry={refetch} /></PageWrapper>;

  const current = billing.plan;

  async function upgrade(plan: BillingPlanName) {
    if (!billing?.stripeEnabled) {
      addToast('Billing isn\'t configured on this deployment yet.', 'info');
      return;
    }
    setBusy(plan);
    try {
      const { url } = await billingApi.checkout(plan);
      window.location.href = url;
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not start checkout.', 'error');
      setBusy(null);
    }
  }

  async function manageBilling() {
    setBusy('portal');
    try {
      const { url } = await billingApi.portal();
      window.location.href = url;
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not open the billing portal.', 'error');
      setBusy(null);
    }
  }

  return (
    <PageWrapper title="Billing & Plan">
      {/* Current plan summary */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-white/80">Current plan</p>
            <h2 className="text-3xl font-black tracking-tight">{current}</h2>
            {billing.status && billing.status !== 'seed' && (
              <p className="text-xs text-white/70 mt-1 capitalize">
                {billing.status}
                {billing.currentPeriodEnd ? ` · renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}` : ''}
              </p>
            )}
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-black">{billing.usage.teams}{billing.limits.maxTeams != null ? `/${billing.limits.maxTeams}` : ''}</p>
              <p className="text-[11px] text-white/70 uppercase tracking-wide">Teams</p>
            </div>
            <div>
              <p className="text-2xl font-black">{billing.usage.players}{billing.limits.maxPlayers != null ? `/${billing.limits.maxPlayers}` : ''}</p>
              <p className="text-[11px] text-white/70 uppercase tracking-wide">Players</p>
            </div>
          </div>
        </div>
        {billing.hasStripeCustomer && (
          <button onClick={manageBilling} disabled={busy === 'portal'} className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors cursor-pointer">
            {busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Manage billing
          </button>
        )}
      </div>

      {!billing.stripeEnabled && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
          Billing is running in preview — checkout is disabled until Stripe keys are configured on the server.
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = plan.name === current;
          const isUpgrade = RANK[plan.name] > RANK[current];
          const Icon = plan.icon;
          return (
            <Card key={plan.name} className={clsx(plan.name === 'Pro' && 'ring-2 ring-indigo-500')}>
              <div className="flex items-center gap-2">
                <Icon size={18} className={plan.accent} />
                <h3 className="font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                {plan.name === 'Pro' && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">POPULAR</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                {plan.name !== 'Free' && <span className="text-sm text-gray-400">/month</span>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{plan.tagline}</p>

              <ul className="mt-4 space-y-2">
                {plan.features.map(f => (
                  <li key={f.label} className="flex items-center gap-2 text-sm">
                    {f.included
                      ? <Check size={15} className="text-emerald-500 flex-shrink-0" />
                      : <X size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                    <span className={f.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">Current plan</div>
                ) : isUpgrade ? (
                  <button
                    onClick={() => upgrade(plan.name)}
                    disabled={busy === plan.name || !billing.stripeEnabled}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {busy === plan.name ? <Loader2 size={15} className="animate-spin" /> : null}
                    Upgrade to {plan.name}
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-center text-sm font-medium text-gray-400">Included below your plan</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        Payments are securely processed by Stripe. Test mode — use card 4242 4242 4242 4242 with any future expiry and CVC.
      </p>
    </PageWrapper>
  );
}
