import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, type Variants } from 'framer-motion';
import {
  Users, Shield, ClipboardList, TrendingUp, ArrowRight,
  Plus, Activity, AlertTriangle, ChevronRight, ShieldAlert, X, CalendarRange, Star, Library,
  RefreshCw,
} from 'lucide-react';
import { useCoachDashboard } from '../../hooks/useDashboard';
import { useTeamReport } from '../../hooks/useReports';
import { useActiveSeasons } from '../../hooks/useSeasons';
import { useActiveInjuries } from '../../hooks/useInjuries';
import { useCoachTasks } from '../../hooks/useTasks';
import { isSeen, markSeen, injuryKey, useSeenVersion } from '../../utils/seenNotifications';
import { TeamWellbeingCard } from '../../components/wellbeing/TeamWellbeingCard';
import { EvidenceRemindersCard } from '../../components/evidence/EvidenceRemindersCard';
import { TeamGoalsCard } from '../../components/goals/TeamGoalsCard';
import { ProfileAnalyticsCard } from '../../components/coaches/ProfileAnalyticsCard';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import { MiniRadar } from '../../components/charts/MiniRadar';
import { useAuth } from '../../context/useAuth';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { clsx } from 'clsx';

const SPORT_GRADIENTS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  Football: {
    bg: 'from-green-500/10 to-emerald-500/5',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20 text-green-400',
    dot: 'bg-green-500',
  },
  Basketball: {
    bg: 'from-orange-500/10 to-amber-500/5',
    border: 'border-orange-500/20',
    badge: 'bg-orange-500/20 text-orange-400',
    dot: 'bg-orange-500',
  },
  Volleyball: {
    bg: 'from-blue-500/10 to-indigo-500/5',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-400',
    dot: 'bg-blue-500',
  },
  'Beach Volleyball': {
    bg: 'from-yellow-500/10 to-amber-500/5',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/20 text-yellow-400',
    dot: 'bg-yellow-500',
  },
  Tennis: {
    bg: 'from-purple-500/10 to-violet-500/5',
    border: 'border-purple-500/20',
    badge: 'bg-purple-500/20 text-purple-400',
    dot: 'bg-purple-500',
  },
};

const DEFAULT_GRADIENT = {
  bg: 'from-indigo-500/10 to-blue-500/5',
  border: 'border-indigo-500/20',
  badge: 'bg-indigo-500/20 text-indigo-400',
  dot: 'bg-indigo-500',
};

function getSportGradient(sportName: string) {
  return SPORT_GRADIENTS[sportName] ?? DEFAULT_GRADIENT;
}

// Per-team avg score + skill-shape thumbnail (same per-card report fan-out as TeamsPage).
function TeamMiniStats({ teamId }: { teamId: number }) {
  const { t } = useTranslation();
  const { data: report } = useTeamReport(teamId);
  const categoryScores = Object.values(report?.averageScoreByCategory ?? {});
  const avg = categoryScores.length
    ? categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
    : null;
  if (avg == null) return null;

  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('teams.avgScore', 'Avg Score')}</p>
        <p className={clsx(
          'text-xl font-black tabular-nums',
          avg > 7 ? 'text-green-500' : avg >= 5 ? 'text-amber-500' : 'text-red-500',
        )}>
          {avg.toFixed(1)}
        </p>
      </div>
      <MiniRadar values={categoryScores} size={64} className="text-gray-500 flex-shrink-0" />
    </div>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.07, ease: 'easeOut' },
  }),
};

export function CoachDashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fmt = useLocaleFormat();
  const L = useDynamicLabels();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCoachDashboard();
  const { data: activeSeasons = [] } = useActiveSeasons();
  const { data: activeInjuries = [], isLoading: loadingInjuries, isError: injuriesError, refetch: refetchInjuries } = useActiveInjuries();
  const { data: allTasks = [], isLoading: loadingTasks, isError: tasksError, refetch: refetchTasks } = useCoachTasks();
  const overdueTasks = allTasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  useSeenVersion(); // re-render when a card item is dismissed
  const visibleInjuries = activeInjuries.filter(inj => !isSeen(injuryKey(inj.id, inj.severity)));

  // The Overdue Tasks / Active Injuries stat cards derive from these two queries —
  // rendering before they resolve shows a false 0 (their data defaults to []).
  if (isLoading || loadingTasks || loadingInjuries) return <DashboardSkeleton />;
  if (isError)
    return (
      <PageWrapper>
        <ErrorState thing="dashboard" onRetry={() => refetch()} />
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? t('dashboard.coach', 'Coach');
  const today = fmt.formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' });

  const statCards = [
    {
      title: t('dashboard.totalPlayers', 'Total Players'),
      value: data?.totalPlayers ?? 0,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: t('dashboard.teamsManaged', 'Teams Managed'),
      value: data?.totalTeams ?? 0,
      icon: Shield,
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      title: t('dashboard.overdueTasks', 'Overdue Tasks'),
      value: overdueTasks.length,
      icon: ClipboardList,
      gradient: 'from-amber-500 to-orange-600',
      // On query error the data defaults to [] — show "—" + retry, never a false 0.
      error: tasksError,
      onRetry: refetchTasks,
    },
    {
      title: t('dashboard.activeInjuries', 'Active Injuries'),
      value: activeInjuries.length,
      icon: ShieldAlert,
      gradient: 'from-red-500 to-rose-600',
      error: injuriesError,
      onRetry: refetchInjuries,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 p-4 lg:p-6 space-y-6"
    >
      {/* Welcome header */}
      <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {t('dashboard.welcome', 'Welcome back')}, {firstName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
              <Activity size={13} />
              {today}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/teams/new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
            >
              <Plus size={15} />
              {t('dashboard.newTeam', 'New Team')}
            </button>
            <button
              onClick={() => navigate('/players/new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus size={15} />
              {t('dashboard.newPlayer', 'New Player')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.title} custom={i + 1} initial="hidden" animate="show" variants={fadeUp}>
            <StatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              gradient={card.gradient}
              valueNode={'error' in card && card.error ? (
                <span className="text-3xl font-black mt-0.5 block text-gray-400 dark:text-gray-500">—</span>
              ) : undefined}
              footer={'error' in card && card.error ? (
                <button
                  onClick={() => card.onRetry?.()}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} /> {t('common.retry', 'Retry')}
                </button>
              ) : undefined}
            />
          </motion.div>
        ))}
      </div>

      {/* Current season(s) across the coach's teams */}
      {activeSeasons.length > 0 && (
        <motion.div custom={4.5} initial="hidden" animate="show" variants={fadeUp}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange size={18} className="text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('dashboard.currentSeason', 'Current Season')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSeasons.map(s => (
              <button
                key={s.id}
                onClick={() => navigate('/seasons')}
                className="text-left rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-900 p-4 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{s.teams.map(t => t.name).join(' · ')}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white flex-shrink-0">
                    <Star size={9} className="fill-current" /> {t('dashboard.current', 'CURRENT')}
                  </span>
                </div>
                <p className="font-bold text-gray-900 dark:text-white mt-1">{s.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {fmt.formatDate(s.startDate, { month: 'short', year: 'numeric' })} – {fmt.formatDate(s.endDate, { month: 'short', year: 'numeric' })}
                  {' · '}{s.linkedPeriodCount} {s.linkedPeriodCount === 1 ? t('dashboard.period', 'period') : t('dashboard.periods', 'periods')}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Teams */}
      <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('dashboard.myTeams', 'My Teams')}</h2>
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
          >
            {t('common.viewAll', 'View all')} <ChevronRight size={15} />
          </button>
        </div>

        {!data?.teams?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8">
            <EmptyState
              icon={<Shield size={36} />}
              title={t('dashboard.noTeamsYet', 'No teams yet')}
              description={t('dashboard.noTeamsDesc', 'Create your first team to start managing players')}
              action={{ label: t('dashboard.createTeam', 'Create Team'), onClick: () => navigate('/teams/new') }}
            />
          </div>
        ) : (
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {data.teams.map((team, i) => {
              const g = getSportGradient(team.sportName);
              return (
                <motion.div
                  key={team.id}
                  custom={i + 6}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  className={clsx(
                    'group relative overflow-hidden rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
                    'min-w-[82%] sm:min-w-0 snap-center flex-shrink-0 sm:flex-shrink',
                    `bg-gradient-to-br ${g.bg} ${g.border}`
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5', g.dot)} />
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full', g.badge)}>
                      {L.sport(team.sportName)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{team.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {team.playerCount ?? 0} {(team.playerCount ?? 0) === 1 ? t('dashboard.player', 'player') : t('dashboard.players', 'players')}
                  </p>
                  <TeamMiniStats teamId={team.id} />
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/teams/${team.id}`); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-white/40 dark:border-white/10 transition-all cursor-pointer"
                    >
                      {t('dashboard.viewTeam', 'View Team')} <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('/players/new'); }}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-white/40 dark:border-white/10 text-gray-600 dark:text-gray-400 transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Add team card */}
            <motion.div
              custom={data.teams.length + 6}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              onClick={() => navigate('/teams/new')}
              className="group rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center min-h-[140px] gap-2 min-w-[60%] sm:min-w-0 snap-center flex-shrink-0 sm:flex-shrink"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors">
                <Plus size={18} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="text-sm font-medium text-gray-400 group-hover:text-indigo-500 transition-colors">{t('dashboard.createNewTeam', 'Create new team')}</p>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Active injuries */}
      {visibleInjuries.length > 0 && (
        <motion.div custom={9} initial="hidden" animate="show" variants={fadeUp}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={17} className="text-red-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('dashboard.activeInjuries', 'Active Injuries')}</h2>
            <span className="text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">{visibleInjuries.length}</span>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {visibleInjuries.map(inj => (
              <div
                key={inj.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <button onClick={() => navigate(`/players/${inj.playerId}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inj.playerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {inj.injuryType}{inj.bodyPart ? ` · ${inj.bodyPart}` : ''}
                    </p>
                  </div>
                  <span className={clsx(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                    inj.severity === 'Severe' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : inj.severity === 'Moderate' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  )}>
                    {L.generic('severity', inj.severity)}
                  </span>
                  <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                </button>
                <button
                  onClick={() => markSeen([injuryKey(inj.id, inj.severity)])}
                  title={t('dashboard.dismiss', 'Dismiss')}
                  className="p-1 rounded-lg text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Evidence reminders (stale tests / low-confidence scores) */}
      <motion.div custom={9.8} initial="hidden" animate="show" variants={fadeUp}>
        <EvidenceRemindersCard />
      </motion.div>

      {/* Team Wellbeing */}
      <motion.div custom={10} initial="hidden" animate="show" variants={fadeUp}>
        <TeamWellbeingCard />
      </motion.div>

      {/* Player Goals overview */}
      <motion.div custom={10.5} initial="hidden" animate="show" variants={fadeUp}>
        <TeamGoalsCard />
      </motion.div>

      {/* Marketplace profile analytics (only when public) */}
      <motion.div custom={10.7} initial="hidden" animate="show" variants={fadeUp}>
        <ProfileAnalyticsCard />
      </motion.div>

      {/* Quick Actions */}
      <motion.div custom={11} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions', 'Quick Actions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('dashboard.viewPlayers', 'View Players'), icon: Users, path: '/players', gradient: 'from-blue-500 to-indigo-600', shadow: 'hover:shadow-blue-500/25' },
            { label: t('nav.drillLibrary', 'Drill Library'), icon: Library, path: '/drills', gradient: 'from-teal-500 to-cyan-600', shadow: 'hover:shadow-teal-500/25' },
            { label: t('nav.reports', 'Reports'), icon: TrendingUp, path: '/reports', gradient: 'from-purple-500 to-violet-600', shadow: 'hover:shadow-purple-500/25' },
            { label: t('dashboard.foodAlternatives', 'Food Alternatives'), icon: ClipboardList, path: '/nutrition/food-alternatives', gradient: 'from-emerald-500 to-green-600', shadow: 'hover:shadow-emerald-500/25' },
            { label: t('dashboard.myProfile', 'My Profile'), icon: Shield, path: '/profile', gradient: 'from-indigo-500 to-purple-600', shadow: 'hover:shadow-indigo-500/25' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={clsx(
                'relative overflow-hidden flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group',
                action.gradient,
                action.shadow,
              )}
            >
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 pointer-events-none group-hover:scale-125 transition-transform" />
              <action.icon size={20} className="group-hover:scale-110 transition-transform drop-shadow" />
              <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
