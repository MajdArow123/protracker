import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Eye, UserPlus, Star, CheckCircle2, Circle, TrendingUp, Store, ArrowRight } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCoachAnalytics } from '../../hooks/useCoachMarketplace';

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ProfileAnalyticsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useCoachAnalytics();

  if (isLoading) return <DetailSkeleton />;
  if (!data) return <PageWrapper title={t('coaches.profileAnalyticsTitle', 'Profile Analytics')}><EmptyState icon={<Store size={30} />} title={t('coaches.noAnalyticsYet', 'No analytics yet')} description={t('coaches.noAnalyticsDesc', 'Enable your public profile to start collecting insights.')} /></PageWrapper>;

  if (!data.isPublic) {
    return (
      <PageWrapper title={t('coaches.profileAnalyticsTitle', 'Profile Analytics')}>
        <EmptyState
          icon={<Store size={30} />}
          title={t('coaches.publicProfileOff', 'Your public profile is off')}
          description={t('coaches.publicProfileOffDesc', 'Turn on your public coaching profile to appear in the marketplace and collect views, requests and reviews.')}
          action={{ label: t('coaches.goToProfileSettings', 'Go to profile settings'), onClick: () => { window.location.href = '/profile'; } }}
        />
      </PageWrapper>
    );
  }

  const trend = data.viewsTrend.map(v => ({ ...v, label: fmtDay(v.date) }));
  const funnel = [
    { label: t('coaches.profileViews', 'Profile views'), value: data.totalViews, color: 'bg-indigo-500' },
    { label: t('coaches.requests', 'Requests'), value: data.totalRequests, color: 'bg-violet-500' },
    { label: t('coaches.accepted', 'Accepted'), value: data.acceptedRequests, color: 'bg-green-500' },
  ];
  const funnelMax = Math.max(...funnel.map(f => f.value), 1);

  return (
    <PageWrapper title={t('coaches.profileAnalyticsTitle', 'Profile Analytics')}>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat icon={<Eye size={16} className="text-indigo-500" />} label={t('coaches.viewsThisWeek', 'Views this week')} value={data.viewsThisWeek} sub={t('coaches.allTime', '{{count}} all time', { count: data.totalViews })} />
        <Stat icon={<UserPlus size={16} className="text-violet-500" />} label={t('coaches.pendingRequests', 'Pending requests')} value={data.pendingRequests} sub={t('coaches.totalCount', '{{count}} total', { count: data.totalRequests })} />
        <Stat icon={<Star size={16} className="text-amber-500" />} label={t('coaches.averageRating', 'Average rating')} value={data.averageRating != null ? data.averageRating.toFixed(1) : '—'} sub={`${data.totalReviews} ${data.totalReviews === 1 ? t('coaches.review', 'review') : t('coaches.reviews', 'reviews')}`} />
        <Stat icon={<TrendingUp size={16} className="text-green-500" />} label={t('coaches.acceptanceRate', 'Acceptance rate')} value={`${data.acceptanceRate}%`} sub={t('coaches.acceptedCount', '{{count}} accepted', { count: data.acceptedRequests })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Views chart */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">{t('coaches.profileViews', 'Profile views')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('coaches.last30Days', 'Last 30 days')}</p>
          {data.totalViews === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">{t('coaches.noViewsYet', 'No views yet — share your profile link to get started.')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <defs>
                  <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#viewsFill)" name={t('coaches.viewsSeries', 'Views')} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Sources */}
          {Object.keys(data.viewsBySource).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.entries(data.viewsBySource).map(([src, n]) => (
                <span key={src} className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
                  {src}: {n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Funnel + completeness */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t('coaches.requestFunnel', 'Request funnel')}</h3>
            <div className="space-y-3">
              {funnel.map(f => (
                <div key={f.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-300">{f.label}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{f.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={clsx('h-full rounded-full', f.color)} style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('coaches.profileCompleteness', 'Profile completeness')}</h3>
              <span className={clsx('text-sm font-bold', data.profileCompleteness >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>{data.profileCompleteness}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-4">
              <div className={clsx('h-full rounded-full', data.profileCompleteness >= 80 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${data.profileCompleteness}%` }} />
            </div>
            <ul className="space-y-1.5">
              {data.completenessItems.map(item => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.done
                    ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                    : <Circle size={15} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                  <span className={clsx('flex-1', item.done ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400')}>{item.label}</span>
                  <span className="text-xs text-gray-400">+{item.weight}%</span>
                </li>
              ))}
            </ul>
            {data.profileCompleteness < 100 && (
              <Link to="/profile" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('coaches.completeYourProfile', 'Complete your profile')} <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">{icon} {label}</div>
      <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
