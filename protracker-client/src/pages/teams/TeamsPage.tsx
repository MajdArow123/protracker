import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Plus, Users, BarChart3,
  Trophy, ClipboardList, ShieldAlert,
} from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import { useTeamReport } from '../../hooks/useReports';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { clsx } from 'clsx';
import type { Team } from '../../types';

const SPORT_GRADIENTS: Record<string, string> = {
  Football: 'from-green-500 via-emerald-600 to-green-700',
  Soccer: 'from-green-500 via-emerald-600 to-green-700',
  'Football / Soccer': 'from-green-500 via-emerald-600 to-green-700',
  Basketball: 'from-orange-400 via-orange-500 to-amber-600',
  Volleyball: 'from-blue-500 via-blue-600 to-indigo-700',
  'Beach Volleyball': 'from-yellow-400 via-amber-500 to-orange-500',
  Tennis: 'from-purple-500 via-violet-600 to-purple-700',
};

const SPORT_DOTS: Record<string, string> = {
  Football: 'bg-green-500',
  Soccer: 'bg-green-500',
  'Football / Soccer': 'bg-green-500',
  Basketball: 'bg-orange-500',
  Volleyball: 'bg-blue-500',
  'Beach Volleyball': 'bg-yellow-500',
  Tennis: 'bg-purple-500',
};

interface TeamCardProps { team: Team; index: number }

function TeamCard({ team, index }: TeamCardProps) {
  const navigate = useNavigate();
  const grad = SPORT_GRADIENTS[team.sportName] ?? 'from-indigo-500 to-violet-600';
  const dot = SPORT_DOTS[team.sportName] ?? 'bg-indigo-500';
  const { data: report } = useTeamReport(team.id);

  const assessedScores = report?.playerAverageScores.filter(p => p.averageScore > 0) ?? [];
  const avgScore = assessedScores.length > 0
    ? assessedScores.reduce((s, p) => s + p.averageScore, 0) / assessedScores.length
    : null;
  const topPerformer = assessedScores.length > 0
    ? assessedScores.reduce((a, b) => (b.averageScore > a.averageScore ? b : a))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Sport gradient header */}
      <div className={clsx('h-20 bg-gradient-to-br relative overflow-hidden', grad)}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 flex items-center px-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center backdrop-blur-sm">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-white text-base leading-tight">{team.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
                <span className="text-white/80 text-xs font-medium">{team.sportName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Users size={14} />
            <span>{team.playerCount ?? 0} players</span>
          </div>
        </div>

        {report && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Avg Score</p>
              <p className={clsx('text-sm font-black', avgScore == null ? 'text-gray-400' :
                avgScore > 7 ? 'text-green-500' : avgScore >= 5 ? 'text-amber-500' : 'text-red-500')}>
                {avgScore != null ? avgScore.toFixed(1) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Top Player</p>
              <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                {topPerformer ? topPerformer.playerName.split(' ')[0] : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Injuries</p>
              <p className={clsx('text-sm font-black flex items-center justify-center gap-1',
                report.activeInjuryCount > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white')}>
                {report.activeInjuryCount > 0 && <ShieldAlert size={12} />}
                {report.activeInjuryCount}
              </p>
            </div>
          </div>
        )}

        {/* Quick action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/teams/${team.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer group/btn"
          >
            <ClipboardList size={13} />
            View Roster
          </button>
          <button
            onClick={() => navigate(`/reports/team/${team.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <BarChart3 size={13} />
            View Report
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function TeamsPage() {
  const navigate = useNavigate();
  const { data: teams, isLoading } = useTeams();

  if (isLoading) return <div className="flex-1 p-4 lg:p-6"><CardListSkeleton count={6} /></div>;

  const totalPlayers = teams?.reduce((s, t) => s + (t.playerCount ?? 0), 0) ?? 0;
  const headerGrad = SPORT_GRADIENTS[teams?.[0]?.sportName ?? ''] ?? 'from-indigo-600 via-indigo-700 to-violet-700';

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className={clsx('bg-gradient-to-br relative overflow-hidden', headerGrad)}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 px-4 lg:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">My Teams</h1>
              <p className="text-white/70 text-sm mt-0.5">
                {teams?.length ?? 0} team{teams?.length !== 1 ? 's' : ''} · {totalPlayers} total players
              </p>
            </div>
            <button
              onClick={() => navigate('/teams/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg shadow-black/20 cursor-pointer"
            >
              <Plus size={16} /> New Team
            </button>
          </div>

          {/* Mini stats */}
          {teams && teams.length > 0 && (
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-white/80 text-sm">
                <Trophy size={14} className="text-yellow-300" />
                <span>{teams[0].sportName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/80 text-sm">
                <Users size={14} />
                <span>{totalPlayers} players tracked</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-6">
        {!teams?.length ? (
          <EmptyState
            icon={<Shield size={48} />}
            title="No teams yet"
            description="Create your first team to start tracking players and performance"
            action={{ label: 'Create First Team', onClick: () => navigate('/teams/new') }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team, i) => (
              <TeamCard key={team.id} team={team} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
