import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useAuth } from '../../context/AuthContext';
import {
  Activity, ClipboardList, TrendingUp, Salad, ChevronRight,
  AlertTriangle, Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.07 },
  }),
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color = score < 5 ? 'bg-red-500' : score < 7 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{label}</span>
        <span className={clsx(
          'text-xs font-bold ml-2',
          score < 5 ? 'text-red-500' : score < 7 ? 'text-amber-500' : 'text-green-500'
        )}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className={clsx('h-full rounded-full', color)}
        />
      </div>
    </div>
  );
}

export function PlayerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data, isLoading, isError } = usePlayerDashboard(playerId);

  if (loadingId || isLoading) return <PageSpinner />;
  if (isError)
    return (
      <PageWrapper>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle size={18} />
          Failed to load dashboard data.
        </div>
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Athlete';
  const latestAssessment = data?.recentAssessments?.[0];
  const radarData = latestAssessment?.statScores?.map((s) => ({
    subject: s.statCategoryName,
    value: s.score,
  })) ?? [];

  const avgScore = data?.latestAverageScore;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 p-4 lg:p-6 space-y-6"
    >
      {/* Hero greeting */}
      <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-200 text-sm mb-2">
              <Zap size={14} />
              Ready to train?
            </div>
            <h1 className="text-2xl font-black tracking-tight">Hi, {firstName}</h1>
            <p className="text-indigo-200 text-sm mt-1">Keep pushing — your next level is within reach.</p>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10 mb-3">
            <ClipboardList size={16} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Assessments</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">{data?.totalAssessments ?? 0}</p>
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="inline-flex p-2 rounded-xl bg-green-500/10 mb-3">
            <Activity size={16} className="text-green-500 dark:text-green-400" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest Score</p>
          <p className={clsx(
            'text-3xl font-black mt-0.5',
            avgScore == null ? 'text-gray-400' : avgScore < 5 ? 'text-red-500' : avgScore < 7 ? 'text-amber-500' : 'text-green-500'
          )}>
            {avgScore != null ? avgScore.toFixed(1) : '—'}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">My Performance</h2>
          {radarData.length === 0 ? (
            <EmptyState icon={<Activity size={32} />} title="No assessment data" description="Your coach will add your stats here" size="sm" />
          ) : (
            <RadarChartWrapper data={radarData} height={260} />
          )}
        </motion.div>

        {/* Score bars */}
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Latest Scores</h2>
            {latestAssessment && (
              <span className="text-xs text-gray-500">{new Date(latestAssessment.dateRecorded).toLocaleDateString()}</span>
            )}
          </div>
          {latestAssessment?.statScores?.length ? (
            <div className="space-y-3">
              {latestAssessment.statScores.map(s => (
                <ScoreBar key={s.id} label={s.statCategoryName} score={s.score} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<ClipboardList size={32} />} title="No scores yet" size="sm" />
          )}
        </motion.div>
      </div>

      {/* Quick nav */}
      <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'My Stats', desc: 'Full assessment history', icon: TrendingUp, path: '/player-dashboard/stats', color: 'text-indigo-500 bg-indigo-500/10' },
            { label: 'My Nutrition', desc: 'Meal plans & dietary profile', icon: Salad, path: '/player-dashboard/nutrition', color: 'text-green-500 bg-green-500/10' },
            { label: 'My Plan', desc: 'Training & improvement', icon: Activity, path: '/player-dashboard/improvement', color: 'text-purple-500 bg-purple-500/10' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="group flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all cursor-pointer text-left"
            >
              <div className={clsx('p-2.5 rounded-xl flex-shrink-0', item.color)}>
                <item.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
