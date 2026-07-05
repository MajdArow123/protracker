import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, ShieldAlert, Activity, Trophy } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { useChildren } from '../../hooks/useParent';
import { clsx } from 'clsx';

function scoreColor(v: number | null | undefined): string {
  if (v == null) return 'text-gray-400';
  if (v < 5) return 'text-red-500';
  if (v <= 7) return 'text-amber-500';
  return 'text-emerald-500';
}

export function ParentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: children = [], isLoading, isError, refetch } = useChildren();

  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  if (isLoading) return <PageWrapper title="My Children"><CardListSkeleton count={3} /></PageWrapper>;
  if (isError) return <PageWrapper title="My Children"><ErrorState onRetry={refetch} /></PageWrapper>;

  return (
    <PageWrapper title="My Children">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white">
        <p className="text-sm text-white/80">Welcome back</p>
        <h1 className="text-2xl font-black tracking-tight">Hi, {firstName}</h1>
        <p className="text-sm text-white/80 mt-1">Follow your {children.length === 1 ? "child's" : "children's"} progress, sessions and wellbeing.</p>
      </div>

      {children.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="No linked children yet"
          description="When a coach links you to a player, they'll appear here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(c => (
            <button
              key={c.playerId}
              onClick={() => navigate(`/parent-dashboard/child/${c.playerId}`)}
              className="text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg">
                  {c.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="font-bold text-gray-900 dark:text-white mt-3">{c.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {[c.positionName, c.teamName].filter(Boolean).join(' · ') || c.sportName}
              </p>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <Trophy size={14} className="text-gray-400" />
                  <span className={clsx('text-sm font-bold', scoreColor(c.overallAverage))}>
                    {c.overallAverage != null ? c.overallAverage.toFixed(1) : '—'}
                  </span>
                  <span className="text-[11px] text-gray-400">avg</span>
                </div>
                {c.fitnessLevel != null && (
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{c.fitnessLevel}/10</span>
                    <span className="text-[11px] text-gray-400">fit</span>
                  </div>
                )}
                {c.activeInjuryCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <ShieldAlert size={11} /> {c.activeInjuryCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
