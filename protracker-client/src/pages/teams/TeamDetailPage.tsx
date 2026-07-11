import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useTeam, useDeleteTeam } from '../../hooks/useTeams';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeamReport } from '../../hooks/useReports';
import { useAssessmentPeriods } from '../../hooks/useAssessmentPeriods';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { ConfirmModal } from '../../components/ui/Modal';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatHeight, formatWeight, getStoredHeightUnit, getStoredWeightUnit } from '../../utils/units';
import { ExportMenu, type ExportOption } from '../../components/ui/ExportMenu';
import { exportCsv, slugify, todayStamp, csvDate, type CsvRow } from '../../utils/csv';
import { matchesApi } from '../../api/matchesApi';
import { reportsApi } from '../../api/reportsApi';
import { tasksApi } from '../../api/tasksApi';
import type { PlayerReport } from '../../types';
import { TeamMatchesSection } from '../../components/matches/TeamMatchesSection';
import { TeamScheduleSection } from '../../components/sessions/TeamScheduleSection';
import { TeamAnnouncementsSection } from '../../components/announcements/TeamAnnouncementsSection';
import { TeamSeasonsSection } from '../../components/seasons/TeamSeasonsSection';
import { TeamInviteSection } from '../../components/teams/TeamInviteSection';
import { CoachingStaffSection } from '../../components/teams/CoachingStaffSection';
import { useMyCoachPermissions } from '../../hooks/useTeamCoaches';
import { TeamPhotoBadge } from '../../components/teams/TeamPhotoBadge';
import { PlayerStatusBadge } from '../../components/players/PlayerStatusBadge';
import { useTeamMatches } from '../../hooks/useMatches';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { TeamEvidenceTab } from '../../components/evidence/TeamEvidenceTab';
import { clsx } from 'clsx';
import {
  ArrowLeft, Edit, Trash2, Plus, Users, ShieldAlert, ClipboardCheck,
  Trophy, Medal, AlertTriangle, Calendar, BarChart3, Star, CalendarRange, ShieldCheck,
} from 'lucide-react';

type TeamTab = 'overview' | 'schedule' | 'matches' | 'seasons' | 'evidence';

const SPORT_HEADER_COLORS: Record<string, string> = {
  Football: 'from-green-600 via-emerald-600 to-green-700',
  Soccer: 'from-green-600 via-emerald-600 to-green-700',
  'Football / Soccer': 'from-green-600 via-emerald-600 to-green-700',
  Basketball: 'from-orange-500 via-orange-600 to-amber-600',
  Volleyball: 'from-blue-600 via-blue-700 to-indigo-700',
  'Beach Volleyball': 'from-yellow-500 via-amber-500 to-orange-500',
  Tennis: 'from-purple-600 via-violet-600 to-purple-700',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function scoreColor(score: number) {
  if (score > 7) return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (score >= 5) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

function AvgScoreRingBadge({ score }: { score: number | null }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = score != null ? (score / 10) * circumference : 0;

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={radius} fill="none"
          stroke="white" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={circumference / 4}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white">{score != null ? score.toFixed(1) : '—'}</span>
      </div>
    </div>
  );
}

export function TeamDetailPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const { id } = useParams<{ id: string }>();
  const teamId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const { data: myPerms } = useMyCoachPermissions(teamId, isCoach);
  // Head coaches get null-safe "all true" via the backend; assistants get their stored perms.
  const canManageTeam = !isCoach || (myPerms?.canManageTeam ?? false);
  const canManagePlayers = !isCoach || (myPerms?.canManagePlayers ?? false);
  const canAssess = !isCoach || (myPerms?.canAssessPlayers ?? false);
  const { data: team, isLoading } = useTeam(teamId);
  const { data: allPlayers = [] } = usePlayers();
  const { data: report } = useTeamReport(teamId);
  const { data: periods = [] } = useAssessmentPeriods();
  const { data: teamMatches = [] } = useTeamMatches(teamId);
  const deleteTeam = useDeleteTeam();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [teamTab, setTeamTab] = useState<TeamTab>('overview');
  const heightUnit = getStoredHeightUnit();
  const weightUnit = getStoredWeightUnit();

  const teamPlayers = allPlayers.filter(p => p.teamId === teamId);
  const teamPeriods = periods.filter(p => p.teamId === teamId);

  if (isLoading) return <DetailSkeleton />;
  if (!team) return (
    <div className="flex-1 p-6">
      <EmptyState icon={<ShieldAlert size={40} />} title={t('teams.teamNotFound', 'Team not found')} description={t('teams.teamNotFoundDesc', 'This team may have been removed.')} />
    </div>
  );

  const headerGrad = SPORT_HEADER_COLORS[team.sportName] ?? 'from-indigo-600 to-violet-700';
  const radarData = report?.averageScoreByCategory
    ? Object.entries(report.averageScoreByCategory).map(([subject, value]) => ({ subject, value }))
    : [];
  const topPerformers = (report?.playerAverageScores ?? []).slice().sort((a, b) => b.averageScore - a.averageScore).slice(0, 3);
  const needsAttention = (report?.playerAverageScores ?? []).slice().sort((a, b) => a.averageScore - b.averageScore).slice(0, 3);
  const injuredIds = new Set((report?.activeInjuries ?? []).map(i => i.playerId));
  const medalIcons = [Trophy, Medal, Medal];
  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

  // Season record from logged match results (W-D-L; draws hidden for sports without them).
  const record = {
    wins: teamMatches.filter(m => m.result === 'Win').length,
    draws: teamMatches.filter(m => m.result === 'Draw').length,
    losses: teamMatches.filter(m => m.result === 'Loss').length,
  };

  const avgTeamScore = radarData.length ? radarData.reduce((s, d) => s + d.value, 0) / radarData.length : null;
  const sortedPeriods = [...teamPeriods].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const lastPeriod = sortedPeriods[0] ?? null;

  const fileFor = (kind: string) => `${slugify(team.name)}-${kind}-${todayStamp()}.csv`;

  const exportOptions: ExportOption[] = [
    {
      label: t('teams.exportRoster', 'Team Roster'),
      description: t('teams.exportRosterDesc', 'Players with bio & fitness'),
      run: () => {
        if (teamPlayers.length === 0) throw new Error(t('teams.noPlayersToExport', 'No players to export.'));
        const rows: CsvRow[] = teamPlayers.map(p => ({
          Name: p.fullName,
          Position: p.positionName ?? '',
          Age: p.age ?? '',
          'Height (cm)': p.height ?? '',
          'Weight (kg)': p.weight ?? '',
          'Fitness (1-10)': p.fitnessLevel ?? '',
          Team: team.name,
        }));
        exportCsv(fileFor('Roster'), rows);
      },
    },
    {
      label: t('teams.exportPlayerStats', 'Player Stats'),
      description: t('teams.exportPlayerStatsDesc', 'Per-player scores by category'),
      run: async () => {
        if (teamPlayers.length === 0) throw new Error(t('teams.noPlayersToExport', 'No players to export.'));
        const reports = await Promise.all(
          teamPlayers.map(p => reportsApi.getPlayerReport(p.id) as Promise<PlayerReport>),
        );
        const categories = [...new Set(reports.flatMap(r => Object.keys(r.averageScoreByCategory)))].sort();
        const rows: CsvRow[] = reports.map(r => {
          const vals = Object.values(r.averageScoreByCategory);
          const overall = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          const row: CsvRow = {
            Name: r.player.fullName,
            Position: r.player.positionName ?? '',
            'Overall Avg': overall ? overall.toFixed(1) : '',
          };
          categories.forEach(c => {
            const v = r.averageScoreByCategory[c];
            row[c] = v != null ? v.toFixed(1) : '';
          });
          return row;
        });
        exportCsv(fileFor('Player-Stats'), rows, ['Name', 'Position', 'Overall Avg', ...categories]);
      },
    },
    {
      label: t('teams.exportMatchResults', 'Match Results'),
      description: t('teams.exportMatchResultsDesc', 'Fixtures, scores & outcomes'),
      run: async () => {
        const matches = await matchesApi.getForTeam(teamId);
        if (matches.length === 0) throw new Error(t('teams.noMatchesToExport', 'No matches to export.'));
        const rows: CsvRow[] = matches.map(m => ({
          Date: csvDate(m.matchDate),
          Opponent: m.opponentName,
          'Home/Away': m.isHome ? 'Home' : 'Away',
          Score: m.scoreDisplay,
          'Our Score': m.ourScore,
          'Opponent Score': m.opponentScore,
          Result: m.result,
          Competition: m.competition ?? '',
          Venue: m.venue ?? '',
        }));
        exportCsv(fileFor('Matches'), rows);
      },
    },
    {
      label: t('teams.exportTasks', 'Tasks'),
      description: t('teams.exportTasksDesc', "This team's assigned tasks"),
      run: async () => {
        const teamPlayerIds = new Set(teamPlayers.map(p => p.id));
        const all = await tasksApi.getForCoach();
        const rows: CsvRow[] = all
          .filter(t => teamPlayerIds.has(t.playerId))
          .map(t => ({
            Player: t.playerName,
            Title: t.title,
            Category: t.category,
            Priority: t.priority,
            'Due Date': csvDate(t.dueDate),
            Status: t.isCompleted ? 'Completed' : 'Open',
            'Completed Date': csvDate(t.completedAt),
          }));
        if (rows.length === 0) throw new Error(t('teams.noTasksToExport', 'No tasks to export for this team.'));
        exportCsv(fileFor('Tasks'), rows);
      },
    },
  ];

  const statCards = [
    { label: t('teams.totalPlayers', 'Total Players'), value: teamPlayers.length, icon: Users },
    { label: t('teams.avgTeamScore', 'Avg Team Score'), value: avgTeamScore != null ? avgTeamScore.toFixed(1) : '—', icon: BarChart3 },
    { label: t('teams.activeInjuries', 'Active Injuries'), value: report?.activeInjuryCount ?? '—', icon: ShieldAlert },
    { label: t('teams.lastAssessment', 'Last Assessment'), value: lastPeriod?.name ?? '—', icon: Calendar },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto">
      {/* Hero header */}
      <div className={clsx('relative overflow-hidden bg-gradient-to-br', headerGrad)}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(isCoach ? '/teams' : '/player-dashboard')}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> {isCoach ? t('nav.teams', 'Teams') : t('nav.dashboard', 'Dashboard')}
            </button>
            {isCoach && (
              <div className="flex gap-2">
                <ExportMenu options={exportOptions} variant="hero" onError={msg => showToast(msg, 'error')} />
                {canAssess && (
                  <button
                    onClick={() => navigate(`/teams/${id}/bulk-assessment`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer border border-white/20"
                  >
                    <ClipboardCheck size={14} /> {t('teams.assessFullTeam', 'Assess Full Team')}
                  </button>
                )}
                {canManageTeam && (
                  <button
                    onClick={() => navigate(`/teams/${id}/edit`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer border border-white/20"
                  >
                    <Edit size={14} /> {t('common.edit', 'Edit')}
                  </button>
                )}
                {canManageTeam && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium transition-all cursor-pointer border border-red-500/30"
                  >
                    <Trash2 size={14} /> {t('common.delete', 'Delete')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <TeamPhotoBadge teamId={teamId} teamName={team.name} photoUrl={team.photoUrl} isCoach={isCoach} />
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">{team.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{L.sport(team.sportName)}</span>
                <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t('teams.playersCount', '{{count}} players', { count: teamPlayers.length })}</span>
                {team.foundedYear && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{t('teams.established', 'Est. {{year}}', { year: team.foundedYear })}</span>
                )}
                {teamMatches.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold" title={t('teams.wdlRecord', 'Win–Draw–Loss record')}>
                    {record.draws > 0
                      ? `${record.wins}W–${record.draws}D–${record.losses}L`
                      : `${record.wins}W–${record.losses}L`}
                  </span>
                )}
                {report?.activeInjuryCount ? (
                  <span className="px-2.5 py-1 rounded-full bg-red-500/30 border border-red-400/40 text-red-200 text-xs font-semibold flex items-center gap-1">
                    <ShieldAlert size={11} /> {t('teams.injuredCount', '{{count}} injured', { count: report.activeInjuryCount })}
                  </span>
                ) : null}
              </div>
              {team.description && (
                <p className="text-white/80 text-sm mt-2 max-w-xl">{team.description}</p>
              )}
            </div>
            </div>
            <AvgScoreRingBadge score={avgTeamScore} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 lg:p-6 pb-0">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={15} className="text-indigo-500" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</p>
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="px-4 lg:px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
          {([
            ['overview', t('teams.tabOverview', 'Overview'), Users],
            ['schedule', t('teams.tabSchedule', 'Schedule'), Calendar],
            ['matches', t('teams.tabMatches', 'Matches'), Star],
            ['seasons', t('teams.tabSeasons', 'Seasons'), CalendarRange],
            ...(isCoach ? [['evidence', t('teams.tabEvidence', 'Evidence'), ShieldCheck] as [TeamTab, string, typeof Users]] : []),
          ] as [TeamTab, string, typeof Users][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTeamTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all cursor-pointer',
                teamTab === id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {teamTab === 'schedule' && (
        <div className="p-4 lg:p-6">
          <TeamScheduleSection teamId={teamId} isCoach={isCoach} />
        </div>
      )}

      {teamTab === 'matches' && (
        <div className="p-4 lg:p-6">
          <TeamMatchesSection teamId={teamId} sportName={team.sportName} sportId={team.sportId} players={teamPlayers.map(p => ({ id: p.id, name: p.fullName }))} isCoach={isCoach} />
        </div>
      )}

      {teamTab === 'seasons' && (
        <div className="p-4 lg:p-6">
          <TeamSeasonsSection teamId={teamId} isCoach={isCoach} />
        </div>
      )}

      {teamTab === 'evidence' && (
        <div className="p-4 lg:p-6">
          <TeamEvidenceTab teamId={teamId} sportId={team.sportId} teamName={team.name} />
        </div>
      )}

      {teamTab === 'overview' && (<>
      {/* Announcements */}
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <TeamAnnouncementsSection teamId={teamId} isCoach={isCoach} />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 lg:p-6">
        {/* Left: Roster */}
        <div className="lg:col-span-3 space-y-4">
          {isCoach && canManagePlayers && <TeamInviteSection teamId={teamId} teamName={team.name} />}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('teams.roster', 'Roster')}</h3>
              {isCoach && canManagePlayers && (
                <button
                  onClick={() => navigate('/players/new')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Plus size={13} /> {t('players.addPlayer', 'Add Player')}
                </button>
              )}
            </div>

            {teamPlayers.length === 0 ? (
              <EmptyState
                icon={<Users size={32} />}
                title={t('players.noPlayers', 'No players yet')}
                description={isCoach ? t('teams.addPlayersToStart', 'Add players to this team to get started') : t('teams.noPlayersOnTeam', 'No players on this team yet')}
                action={isCoach ? { label: t('players.addPlayer', 'Add Player'), onClick: () => navigate('/players/new') } : undefined}
                size="sm"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teamPlayers.map(p => {
                  const avgScore = report?.playerAverageScores?.find(s => s.playerId === p.id)?.averageScore;
                  const isInjured = injuredIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => isCoach && navigate(`/players/${p.id}`)}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 transition-all text-left group',
                        isCoach ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-black flex-shrink-0">
                        {getInitials(p.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {p.jerseyNumber != null && <span className="text-indigo-500 font-black mr-1">#{p.jerseyNumber}</span>}
                            {p.fullName}
                          </p>
                          <PlayerStatusBadge status={p.status} hideActive />
                          {isInjured && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {p.positionName ?? t('players.player', 'Player')}
                          {(p.height != null || p.weight != null) && (
                            <span className="text-gray-400 dark:text-gray-500">
                              {' · '}
                              {[formatHeight(p.height, heightUnit), formatWeight(p.weight, weightUnit)].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {avgScore != null && (
                          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', scoreColor(avgScore))}>
                            {avgScore.toFixed(1)}
                          </span>
                        )}
                        {p.fitnessLevel != null && (
                          <span className="text-[10px] text-gray-400">{t('players.fitShort', 'Fit')} {p.fitnessLevel}/10</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Analytics */}
        <div className="lg:col-span-2 space-y-4">
          {isCoach && <CoachingStaffSection teamId={teamId} />}
          {/* Team radar */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">{t('teams.teamSkillProfile', 'Team Skill Profile')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('teams.avgAcrossPlayers', 'Average across all players')}</p>
            {radarData.length > 0 ? (
              <RadarChartWrapper data={radarData} height={220} />
            ) : (
              <div className="flex flex-col items-center justify-center h-36 text-center">
                <BarChart3 size={24} className="text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('players.noAssessmentData', 'No assessment data yet')}</p>
              </div>
            )}
          </div>

          {/* Top performers */}
          {topPerformers.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('teams.topPerformers', 'Top Performers')}</h3>
              <div className="space-y-2">
                {topPerformers.map((p, i) => {
                  const MedalIcon = medalIcons[i] ?? Medal;
                  const player = teamPlayers.find(pl => pl.id === p.playerId);
                  return (
                    <div
                      key={p.playerId}
                      onClick={() => isCoach && navigate(`/players/${p.playerId}`)}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left',
                        isCoach ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <MedalIcon size={16} className={medalColors[i]} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.playerName}</p>
                        <p className="text-xs text-gray-500">{player?.positionName ?? t('players.player', 'Player')}</p>
                      </div>
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', scoreColor(p.averageScore))}>
                        {p.averageScore.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Needs attention */}
          {needsAttention.length > 0 && needsAttention[0].averageScore < 7 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-5">
              <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle size={15} /> {t('teams.needsAttention', 'Needs Attention')}
              </h3>
              <div className="space-y-2">
                {needsAttention.filter(p => p.averageScore < 7).slice(0, 3).map(p => {
                  const isInjured = injuredIds.has(p.playerId);
                  return (
                    <div
                      key={p.playerId}
                      onClick={() => isCoach && navigate(`/players/${p.playerId}`)}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left',
                        isCoach ? 'hover:bg-amber-100/50 dark:hover:bg-amber-900/20 cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.playerName}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">{isInjured ? t('teams.injuredPrefix', 'Injured · ') : ''}{t('teams.scoreValue', 'Score {{score}}/10', { score: p.averageScore.toFixed(1) })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assessment periods */}
      <div className="px-4 lg:px-6 pb-6">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar size={15} className="text-indigo-400" /> {t('teams.assessmentPeriods', 'Assessment Periods')}
          </h3>
          {sortedPeriods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('teams.noAssessmentPeriods', 'No assessment periods created yet.')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedPeriods.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(p.startDate, { month: 'short', day: 'numeric' })}
                      {' – '}
                      {formatDate(p.endDate, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {i === 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 flex-shrink-0">{t('teams.latest', 'Latest')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>)}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteTeam.mutateAsync(teamId);
            showToast(t('teams.teamDeleted', 'Team deleted'), 'success');
            navigate('/teams');
          } catch (err) {
            showToast(err instanceof Error ? err.message : t('teams.deleteFailed', 'Delete failed'), 'error');
          } finally { setConfirmDelete(false); }
        }}
        title={t('teams.deleteTeam', 'Delete Team')}
        message={t('teams.deleteTeamMsg', 'Permanently delete "{{name}}"? This cannot be undone.', { name: team.name })}
        confirmLabel={t('common.delete', 'Delete')}
        isLoading={deleteTeam.isPending}
      />
    </motion.div>
  );
}
