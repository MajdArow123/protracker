import { Link } from 'react-router-dom';
import { Eye, UserPlus, Star, ArrowRight, Store } from 'lucide-react';
import { useCoachAnalytics } from '../../hooks/useCoachMarketplace';

// Coach-dashboard card — renders only when the coach's public profile is live.
export function ProfileAnalyticsCard() {
  const { data } = useCoachAnalytics();
  if (!data || !data.isPublic) return null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex p-2 rounded-xl bg-indigo-500/10"><Store size={16} className="text-indigo-500" /></div>
        <h2 className="font-bold text-gray-900 dark:text-white">Marketplace Profile</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Metric icon={<Eye size={14} className="text-indigo-500" />} value={data.viewsThisWeek} label="views / wk" />
        <Metric icon={<UserPlus size={14} className="text-violet-500" />} value={data.pendingRequests} label="pending" />
        <Metric icon={<Star size={14} className="text-amber-500" />} value={data.averageRating != null ? data.averageRating.toFixed(1) : '—'} label={`${data.totalReviews} review${data.totalReviews === 1 ? '' : 's'}`} />
      </div>

      <Link to="/coach/profile-analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:gap-1.5 transition-all">
        View Full Analytics <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <div className="text-xl font-black text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
