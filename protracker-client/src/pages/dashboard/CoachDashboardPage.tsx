import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  Users, Shield, ClipboardList, TrendingUp, ArrowRight,
  Plus, Activity, AlertTriangle, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { useCoachDashboard } from '../../hooks/useDashboard';
import { useActiveInjuries } from '../../hooks/useInjuries';
import { useCoachTasks } from '../../hooks/useTasks';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
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
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCoachDashboard();
  const { data: activeInjuries = [] } = useActiveInjuries();
  const { data: allTasks = [] } = useCoachTasks();
  const overdueTasks = allTasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate).getTime() < Date.now());

  if (isLoading) return <PageSpinner />;
  if (isError)
    return (
      <PageWrapper>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle size={18} />
          Failed to load dashboard data.
        </div>
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Coach';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const statCards = [
    {
      title: 'Total Players',
      value: data?.totalPlayers ?? 0,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-500/10 dark:bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Teams Managed',
      value: data?.totalTeams ?? 0,
      icon: Shield,
      gradient: 'from-purple-500 to-violet-600',
      bg: 'bg-purple-500/10',
      text: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Overdue Tasks',
      value: overdueTasks.length,
      icon: ClipboardList,
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Active Injuries',
      value: activeInjuries.length,
      icon: ShieldAlert,
      gradient: 'from-red-500 to-rose-600',
      bg: 'bg-red-500/10',
      text: 'text-red-600 dark:text-red-400',
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
              Welcome back, {firstName}
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
              New Team
            </button>
            <button
              onClick={() => navigate('/players/new')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus size={15} />
              New Player
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            custom={i + 1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 group hover:border-gray-300 dark:hover:border-gray-700 transition-all"
          >
            <div className={clsx('inline-flex p-2.5 rounded-xl mb-3', card.bg)}>
              <card.icon size={18} className={card.text} />
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.title}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Teams */}
      <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">My Teams</h2>
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
          >
            View all <ChevronRight size={15} />
          </button>
        </div>

        {!data?.teams?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8">
            <EmptyState
              icon={<Shield size={36} />}
              title="No teams yet"
              description="Create your first team to start managing players"
              action={{ label: 'Create Team', onClick: () => navigate('/teams/new') }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.teams.map((t, i) => {
              const g = getSportGradient(t.sportName);
              return (
                <motion.div
                  key={t.id}
                  custom={i + 6}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  onClick={() => navigate(`/teams/${t.id}`)}
                  className={clsx(
                    'group relative overflow-hidden rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
                    `bg-gradient-to-br ${g.bg} ${g.border}`
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5', g.dot)} />
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full', g.badge)}>
                      {t.sportName}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{t.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t.playerCount ?? 0} {(t.playerCount ?? 0) === 1 ? 'player' : 'players'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/teams/${t.id}`); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-white/40 dark:border-white/10 transition-all cursor-pointer"
                    >
                      View Team <ArrowRight size={12} />
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
              className="group rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-5 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex flex-col items-center justify-center min-h-[140px] gap-2"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center transition-colors">
                <Plus size={18} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="text-sm font-medium text-gray-400 group-hover:text-indigo-500 transition-colors">Create new team</p>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Active injuries */}
      {activeInjuries.length > 0 && (
        <motion.div custom={9} initial="hidden" animate="show" variants={fadeUp}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={17} className="text-red-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Active Injuries</h2>
            <span className="text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5">{activeInjuries.length}</span>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {activeInjuries.map(inj => (
              <button
                key={inj.id}
                onClick={() => navigate(`/players/${inj.playerId}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer first:rounded-t-2xl last:rounded-b-2xl"
              >
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
                  {inj.severity}
                </span>
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div custom={10} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'View Players', icon: Users, path: '/players', color: 'text-blue-500' },
            { label: 'Reports', icon: TrendingUp, path: '/reports', color: 'text-purple-500' },
            { label: 'Food Alternatives', icon: ClipboardList, path: '/nutrition/food-alternatives', color: 'text-green-500' },
            { label: 'My Profile', icon: Shield, path: '/profile', color: 'text-indigo-500' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all cursor-pointer group"
            >
              <action.icon size={20} className={clsx(action.color, 'group-hover:scale-110 transition-transform')} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
