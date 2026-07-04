import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, useDeletePlayer } from '../../hooks/usePlayers';
import { useInjuries, useCreateInjury, useUpdateInjury, useDeleteInjury, useRecoverInjury } from '../../hooks/useInjuries';
import { useMatchPerformance, useCreateMatchPerformance, useUpdateMatchPerformance, useDeleteMatchPerformance } from '../../hooks/useMatchPerformance';
import { useTrainingSessions, useCreateTrainingSession, useUpdateTrainingSession, useDeleteTrainingSession } from '../../hooks/useTrainingSessions';
import { useTeams } from '../../hooks/useTeams';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { Users } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';
import {
  ArrowLeft, Edit, Trash2, ClipboardList, TrendingUp, TrendingDown, Salad,
  Plus, Edit2, Activity, Dumbbell, ShieldAlert, Star,
  Calendar, Clock, ChevronRight, CheckSquare, StickyNote, HeartPulse,
} from 'lucide-react';
import type { InjuryRecord, MatchPerformance, TrainingSession, PlayerTask } from '../../types';
import { AutoSaveStatus } from '../../components/ui/AutoSaveStatus';
import { formatHeight, formatWeight, getStoredHeightUnit, getStoredWeightUnit } from '../../utils/units';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useCoachTasks, useDeleteTask } from '../../hooks/useTasks';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { CoachNotesTab } from '../../components/notes/CoachNotesTab';
import { RecoveryPlanModal } from '../../components/recovery/RecoveryPlanModal';
import { WellbeingTrendCard } from '../../components/wellbeing/WellbeingTrendCard';

type Tab = 'overview' | 'injuries' | 'matches' | 'training' | 'tasks' | 'wellbeing' | 'notes';

const INJURY_SEVERITIES = ['Minor', 'Moderate', 'Severe'] as const;
const RECOVERY_STATUSES = ['Active', 'Recovering', 'FullyRecovered'] as const;
const BODY_PARTS = ['Knee', 'Ankle', 'Shoulder', 'Back', 'Hamstring', 'Quad', 'Calf', 'Hip', 'Wrist', 'Other'] as const;
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const;

const TEXTAREA_CLS = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition-all';

const SEVERITY_STYLES: Record<string, string> = {
  Minor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Moderate: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  Severe: 'bg-red-500/20 text-red-400 border border-red-500/30',
};
const RECOVERY_STYLES: Record<string, string> = {
  Active: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Recovering: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  FullyRecovered: 'bg-green-500/20 text-green-400 border border-green-500/30',
};
const ATTENDANCE_STYLES: Record<string, string> = {
  Present: 'bg-green-500/20 text-green-400 border border-green-500/30',
  Absent: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Late: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Excused: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

const SPORT_HEADER_COLORS: Record<string, string> = {
  Football: 'from-green-600 to-emerald-700',
  Basketball: 'from-orange-500 to-amber-600',
  Volleyball: 'from-blue-600 to-indigo-700',
  'Beach Volleyball': 'from-yellow-500 to-amber-600',
  Tennis: 'from-purple-600 to-violet-700',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getFitnessLabel(level: number) {
  if (level <= 3) return 'Beginner';
  if (level <= 6) return 'Intermediate';
  if (level <= 8) return 'Advanced';
  return 'Elite';
}

interface InjuryFormState {
  injuryDate: string; injuryType: string; bodyPart: string; severity: string;
  recoveryStatus: string; notes: string; treatmentPlan: string; expectedReturnDate: string;
}
const EMPTY_INJURY: InjuryFormState = {
  injuryDate: new Date().toISOString().split('T')[0],
  injuryType: '', bodyPart: 'Other', severity: 'Minor', recoveryStatus: 'Active', notes: '', treatmentPlan: '', expectedReturnDate: '',
};

interface MatchFormState {
  matchDate: string; opponent: string; performanceRating: string; notes: string; sportSpecificStats: string;
}
const EMPTY_MATCH: MatchFormState = {
  matchDate: new Date().toISOString().split('T')[0],
  opponent: '', performanceRating: '7', notes: '', sportSpecificStats: '',
};

interface TrainingFormState {
  date: string; durationMinutes: string; teamId: string; attendanceStatus: string; notes: string;
}
const EMPTY_TRAINING: TrainingFormState = {
  date: new Date().toISOString().split('T')[0],
  durationMinutes: '60', teamId: '', attendanceStatus: 'Present', notes: '',
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={clsx('w-1.5 h-4 rounded-sm', i < rating ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700')} />
      ))}
      <span className="ml-1 text-xs font-bold text-indigo-500">{rating}/10</span>
    </div>
  );
}

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading } = usePlayer(playerId);
  const { data: teams = [] } = useTeams();
  const { data: injuries = [] } = useInjuries(playerId);
  const { data: matches = [] } = useMatchPerformance(playerId);
  const { data: sessions = [] } = useTrainingSessions(playerId);
  const { data: assessments = [] } = usePlayerAssessments(playerId);
  const { data: playerTasks = [] } = useCoachTasks({ playerId });
  const deleteTask = useDeleteTask();
  const heightUnit = getStoredHeightUnit();
  const weightUnit = getStoredWeightUnit();

  const createInjury = useCreateInjury();
  const updateInjury = useUpdateInjury();
  const deleteInjury = useDeleteInjury();
  const recoverInjury = useRecoverInjury();
  const createMatch = useCreateMatchPerformance();
  const updateMatch = useUpdateMatchPerformance();
  const deleteMatch = useDeleteMatchPerformance();
  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const deletePlayer = useDeletePlayer();

  const [tab, setTab] = useState<Tab>('overview');
  const [recoveryInjuryId, setRecoveryInjuryId] = useState<number | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<PlayerTask | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<PlayerTask | null>(null);
  const [injuryForm, setInjuryForm] = useState<InjuryFormState>(EMPTY_INJURY);
  const [editingInjury, setEditingInjury] = useState<InjuryRecord | null>(null);
  const [showNewInjury, setShowNewInjury] = useState(false);
  const [deleteInjuryTarget, setDeleteInjuryTarget] = useState<InjuryRecord | null>(null);
  const [matchForm, setMatchForm] = useState<MatchFormState>(EMPTY_MATCH);
  const [editingMatch, setEditingMatch] = useState<MatchPerformance | null>(null);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [deleteMatchTarget, setDeleteMatchTarget] = useState<MatchPerformance | null>(null);
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(EMPTY_TRAINING);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<TrainingSession | null>(null);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(false);

  function openNewInjury() { setEditingInjury(null); setInjuryForm(EMPTY_INJURY); setShowNewInjury(true); }
  function openEditInjury(r: InjuryRecord) {
    setEditingInjury(r);
    setInjuryForm({ injuryDate: r.injuryDate.split('T')[0], injuryType: r.injuryType, bodyPart: r.bodyPart ?? 'Other', severity: r.severity, recoveryStatus: r.recoveryStatus, notes: r.notes ?? '', treatmentPlan: r.treatmentPlan ?? '', expectedReturnDate: r.expectedReturnDate ? r.expectedReturnDate.split('T')[0] : '' });
    setShowNewInjury(false);
  }
  function buildInjuryPayload() {
    return { playerId, injuryDate: injuryForm.injuryDate, injuryType: injuryForm.injuryType, bodyPart: injuryForm.bodyPart || undefined, severity: injuryForm.severity as InjuryRecord['severity'], recoveryStatus: injuryForm.recoveryStatus as InjuryRecord['recoveryStatus'], notes: injuryForm.notes || undefined, treatmentPlan: injuryForm.treatmentPlan || undefined, expectedReturnDate: injuryForm.expectedReturnDate || undefined };
  }

  const autoSaveInjury = useCallback(async () => {
    if (!editingInjury || !injuryForm.injuryType.trim()) return;
    await updateInjury.mutateAsync({ id: editingInjury.id, data: buildInjuryPayload() });
  }, [editingInjury, injuryForm]);

  const { status: injurySaveStatus, flush: flushInjury } = useAutoSave(!!editingInjury, injuryForm, autoSaveInjury);

  async function saveInjury() {
    if (!injuryForm.injuryType.trim()) { showToast('Injury type required', 'error'); return; }
    try {
      if (editingInjury) { await flushInjury(); setEditingInjury(null); }
      else { await createInjury.mutateAsync(buildInjuryPayload() as Parameters<typeof createInjury.mutateAsync>[0]); showToast('Injury recorded', 'success'); setShowNewInjury(false); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  function openNewMatch() { setEditingMatch(null); setMatchForm(EMPTY_MATCH); setShowNewMatch(true); }
  function openEditMatch(m: MatchPerformance) {
    setEditingMatch(m);
    setMatchForm({ matchDate: m.matchDate, opponent: m.opponent, performanceRating: String(m.performanceRating), notes: m.notes ?? '', sportSpecificStats: m.sportSpecificStats ?? '' });
    setShowNewMatch(false);
  }
  function buildMatchPayload() {
    const rating = Number(matchForm.performanceRating);
    return { playerId, matchDate: matchForm.matchDate, opponent: matchForm.opponent, performanceRating: rating, notes: matchForm.notes || undefined, sportSpecificStats: matchForm.sportSpecificStats || undefined };
  }

  const autoSaveMatch = useCallback(async () => {
    if (!editingMatch || !matchForm.opponent.trim()) return;
    const rating = Number(matchForm.performanceRating);
    if (isNaN(rating) || rating < 1 || rating > 10) return;
    await updateMatch.mutateAsync({ id: editingMatch.id, data: buildMatchPayload() });
  }, [editingMatch, matchForm]);

  const { status: matchSaveStatus, flush: flushMatch } = useAutoSave(!!editingMatch, matchForm, autoSaveMatch);

  async function saveMatch() {
    if (!matchForm.opponent.trim()) { showToast('Opponent required', 'error'); return; }
    const rating = Number(matchForm.performanceRating);
    if (isNaN(rating) || rating < 1 || rating > 10) { showToast('Rating must be 1–10', 'error'); return; }
    try {
      if (editingMatch) { await flushMatch(); setEditingMatch(null); }
      else { await createMatch.mutateAsync(buildMatchPayload() as Parameters<typeof createMatch.mutateAsync>[0]); showToast('Match recorded', 'success'); setShowNewMatch(false); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  function openNewSession() { setEditingSession(null); setTrainingForm({ ...EMPTY_TRAINING, teamId: player?.teamId?.toString() ?? '' }); setShowNewSession(true); }
  function openEditSession(s: TrainingSession) {
    setEditingSession(s);
    setTrainingForm({ date: s.date, durationMinutes: String(s.durationMinutes), teamId: String(s.teamId), attendanceStatus: s.attendanceStatus, notes: s.notes ?? '' });
    setShowNewSession(false);
  }
  function buildSessionPayload() {
    const duration = Number(trainingForm.durationMinutes);
    return { playerId, teamId: Number(trainingForm.teamId), date: trainingForm.date, durationMinutes: duration, attendanceStatus: trainingForm.attendanceStatus as TrainingSession['attendanceStatus'], notes: trainingForm.notes || undefined };
  }

  const autoSaveSession = useCallback(async () => {
    if (!editingSession || !trainingForm.teamId) return;
    const duration = Number(trainingForm.durationMinutes);
    if (isNaN(duration) || duration < 1 || duration > 300) return;
    await updateSession.mutateAsync({ id: editingSession.id, data: buildSessionPayload() });
  }, [editingSession, trainingForm]);

  const { status: sessionSaveStatus, flush: flushSession } = useAutoSave(!!editingSession, trainingForm, autoSaveSession);

  async function saveSession() {
    const duration = Number(trainingForm.durationMinutes);
    if (isNaN(duration) || duration < 1 || duration > 300) { showToast('Duration must be 1–300 min', 'error'); return; }
    if (!trainingForm.teamId) { showToast('Select a team', 'error'); return; }
    try {
      if (editingSession) { await flushSession(); setEditingSession(null); }
      else { await createSession.mutateAsync(buildSessionPayload() as Parameters<typeof createSession.mutateAsync>[0]); showToast('Session recorded', 'success'); setShowNewSession(false); }
    } catch (err) { showToast(err instanceof Error ? err.message : 'Save failed', 'error'); }
  }

  if (isLoading) return <DetailSkeleton />;
  if (!player) return (
    <div className="flex-1 p-6">
      <EmptyState icon={<Users size={40} />} title="Player not found" description="This player may have been removed." />
    </div>
  );

  const sportName = player.teamName ? '' : '';
  const headerGrad = SPORT_HEADER_COLORS[sportName] ?? 'from-indigo-600 to-violet-700';
  const fitnessLabel = player.fitnessLevel ? getFitnessLabel(player.fitnessLevel) : null;

  const TABS: { id: Tab; label: string; icon: typeof Activity; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'injuries', label: 'Injuries', icon: ShieldAlert, count: injuries.length },
    { id: 'matches', label: 'Matches', icon: Star, count: matches.length },
    { id: 'training', label: 'Training', icon: Dumbbell, count: sessions.length },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: playerTasks.length },
    { id: 'wellbeing', label: 'Wellbeing', icon: HeartPulse },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto">
      {/* Hero Header */}
      <div className={clsx('relative overflow-hidden bg-gradient-to-br', headerGrad || 'from-indigo-600 to-purple-700')}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 p-4 lg:p-6">
          {/* Nav row */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/players')}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} /> Players
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/players/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all cursor-pointer border border-white/20"
              >
                <Edit size={14} /> Edit
              </button>
              <button
                onClick={() => setConfirmDeletePlayer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium transition-all cursor-pointer border border-red-500/30"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {/* Player info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black flex-shrink-0 shadow-xl">
              {getInitials(player.fullName)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">{player.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {player.positionName && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{player.positionName}</span>
                )}
                {player.teamName && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{player.teamName}</span>
                )}
                {fitnessLabel && (
                  <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold">{fitnessLabel}</span>
                )}
              </div>
              {/* Quick stats */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-white/70">
                {player.age && <span>{player.age} yrs</span>}
                {player.height != null && <span>{formatHeight(player.height, heightUnit)}</span>}
                {player.weight != null && <span>{formatWeight(player.weight, weightUnit)}</span>}
                {player.fitnessLevel && <span>Fitness {player.fitnessLevel}/10</span>}
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {[
              { label: 'Assessment', icon: ClipboardList, path: `/players/${id}/assessment` },
              { label: 'Improvement Plan', icon: TrendingUp, path: `/players/${id}/improvement-plan` },
              { label: 'Nutrition', icon: Salad, path: `/players/${id}/nutrition` },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="group flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all cursor-pointer"
              >
                <item.icon size={14} />
                {item.label}
                <ChevronRight size={13} className="opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active injury banner */}
      {(() => {
        const active = injuries.filter(i => i.recoveryStatus !== 'FullyRecovered');
        if (active.length === 0) return null;
        return (
          <div className="mx-4 lg:mx-6 mt-4 flex items-center gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 px-4 py-2.5">
            <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {active.length === 1
                ? `Active injury: ${active[0].injuryType}${active[0].bodyPart ? ` (${active[0].bodyPart})` : ''}`
                : `${active.length} active injuries`}
            </p>
            <button onClick={() => setTab('injuries')} className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer">View</button>
          </div>
        );
      })()}

      {/* Sticky Tab Nav */}
      <div className="sticky top-14 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex overflow-x-auto px-4 lg:px-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all cursor-pointer',
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <t.icon size={15} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={clsx(
                  'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  tab === t.id ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 lg:p-6">
        <AnimatePresence mode="wait">
          {/* Overview tab */}
          {tab === 'overview' && (() => {
            const latestAssessment = assessments[0];
            const firstAssessment = assessments[assessments.length - 1];
            const radarData = latestAssessment?.statScores?.map(s => ({ subject: s.statCategoryName, value: s.score })) ?? [];
            const firstAvg = firstAssessment?.statScores?.length
              ? firstAssessment.statScores.reduce((sum, s) => sum + s.score, 0) / firstAssessment.statScores.length
              : null;
            const latestAvg = latestAssessment?.statScores?.length
              ? latestAssessment.statScores.reduce((sum, s) => sum + s.score, 0) / latestAssessment.statScores.length
              : null;
            const progressPct = (firstAvg && latestAvg && assessments.length > 1)
              ? Math.round(((latestAvg - firstAvg) / firstAvg) * 100)
              : null;
            const bestStat = latestAssessment?.statScores?.reduce((a, b) => a.score > b.score ? a : b, latestAssessment.statScores[0]);
            const worstStat = latestAssessment?.statScores?.reduce((a, b) => a.score < b.score ? a : b, latestAssessment.statScores[0]);

            return (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left column */}
                <div className="lg:col-span-3 space-y-4">
                  {(player.age || player.height || player.weight || player.fitnessLevel) && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-3">Physical Profile</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Age', value: player.age, unit: 'yrs' },
                          { label: 'Height', value: player.height, display: formatHeight(player.height, heightUnit) },
                          { label: 'Weight', value: player.weight, display: formatWeight(player.weight, weightUnit) },
                          { label: 'Fitness', value: player.fitnessLevel, unit: '/10' },
                        ].filter(s => s.value).map(s => (
                          <div key={s.label} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white">
                              {s.display ?? <>{s.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{s.unit}</span></>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {player.goals && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">Goals</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{player.goals}</p>
                    </div>
                  )}

                  {player.coachNotes && (
                    <div className="rounded-2xl border border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-5">
                      <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">Coach Notes</h3>
                      <p className="text-sm text-amber-600 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">{player.coachNotes}</p>
                    </div>
                  )}

                  {player.injuryNotes && (
                    <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
                      <h3 className="font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2"><ShieldAlert size={15} /> Injury Notes</h3>
                      <p className="text-sm text-red-600 dark:text-red-300 leading-relaxed whitespace-pre-wrap">{player.injuryNotes}</p>
                    </div>
                  )}

                  {assessments.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-900 dark:text-white">Recent Assessments</h3>
                        <button onClick={() => navigate(`/players/${id}/assessment`)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer">
                          View all
                        </button>
                      </div>
                      <div className="space-y-2">
                        {assessments.slice(0, 3).map(a => {
                          const avg = a.statScores?.length ? (a.statScores.reduce((s, x) => s + x.score, 0) / a.statScores.length) : null;
                          return (
                            <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{a.assessmentPeriodName}</p>
                                <p className="text-xs text-gray-500">{new Date(a.dateRecorded).toLocaleDateString()}</p>
                              </div>
                              {avg !== null && (
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', avg > 7 ? 'bg-green-500/20 text-green-400' : avg >= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>
                                  {avg.toFixed(1)}/10
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!player.goals && !player.coachNotes && !player.injuryNotes && assessments.length === 0 && (
                    <EmptyState
                      icon={<Activity size={36} />}
                      title="No profile data yet"
                      description="Add goals, notes, and assessments to build this player's profile"
                      action={{ label: 'Edit Player', onClick: () => navigate(`/players/${id}/edit`) }}
                    />
                  )}
                </div>

                {/* Right column */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Skill radar */}
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Skill Profile</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Latest assessment</p>
                    {radarData.length > 0 ? (
                      <RadarChartWrapper data={radarData} height={240} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-center">
                        <Activity size={28} className="text-gray-400 mb-2" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No assessment data yet</p>
                        <button
                          onClick={() => navigate(`/players/${id}/assessment`)}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Add Assessment
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Performance trend */}
                  {progressPct !== null && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-3">Overall Progress</h3>
                      <div className={clsx('flex items-center gap-3 p-3 rounded-xl', progressPct >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20')}>
                        {progressPct >= 0
                          ? <TrendingUp size={22} className="text-green-400 flex-shrink-0" />
                          : <TrendingDown size={22} className="text-red-400 flex-shrink-0" />}
                        <div>
                          <p className={clsx('text-lg font-black', progressPct >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {progressPct >= 0 ? '+' : ''}{progressPct}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">since first assessment</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick stats */}
                  {latestAssessment && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-3">Quick Stats</h3>
                      <div className="space-y-2.5">
                        {bestStat && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Best Stat</span>
                            <span className="text-xs font-semibold text-green-400">{bestStat.statCategoryName} — {bestStat.score}/10</span>
                          </div>
                        )}
                        {worstStat && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Weakest Stat</span>
                            <span className="text-xs font-semibold text-red-400">{worstStat.statCategoryName} — {worstStat.score}/10</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Assessments</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{assessments.length} recorded</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Last Assessment</span>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{new Date(latestAssessment.dateRecorded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* Injuries tab */}
          {tab === 'injuries' && (
            <motion.div key="injuries" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="max-w-2xl space-y-4">
              {!(showNewInjury || editingInjury) && (
                <div className="flex justify-end">
                  <button onClick={openNewInjury} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
                    <Plus size={15} /> Record Injury
                  </button>
                </div>
              )}

              {(showNewInjury || editingInjury) && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingInjury ? 'Edit Injury' : 'Record Injury'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Injury Date" type="date" value={injuryForm.injuryDate} onChange={e => setInjuryForm(v => ({ ...v, injuryDate: e.target.value }))} />
                    <Input label="Injury Type *" value={injuryForm.injuryType} onChange={e => setInjuryForm(v => ({ ...v, injuryType: e.target.value }))} placeholder="e.g. Hamstring strain" />
                    <Select label="Body Part" value={injuryForm.bodyPart} onChange={e => setInjuryForm(v => ({ ...v, bodyPart: e.target.value }))} options={BODY_PARTS.map(s => ({ value: s, label: s }))} />
                    <Select label="Severity" value={injuryForm.severity} onChange={e => setInjuryForm(v => ({ ...v, severity: e.target.value }))} options={INJURY_SEVERITIES.map(s => ({ value: s, label: s }))} />
                    <Select label="Recovery Status" value={injuryForm.recoveryStatus} onChange={e => setInjuryForm(v => ({ ...v, recoveryStatus: e.target.value }))} options={RECOVERY_STATUSES.map(s => ({ value: s, label: s }))} />
                    <Input label="Expected Return Date" type="date" value={injuryForm.expectedReturnDate} onChange={e => setInjuryForm(v => ({ ...v, expectedReturnDate: e.target.value }))} />
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Treatment Plan</label>
                      <textarea value={injuryForm.treatmentPlan} onChange={e => setInjuryForm(v => ({ ...v, treatmentPlan: e.target.value }))} rows={2} placeholder="Rehab protocol, physio schedule…" className={TEXTAREA_CLS} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea value={injuryForm.notes} onChange={e => setInjuryForm(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Details…" className={TEXTAREA_CLS} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 mt-4">
                    {editingInjury && <AutoSaveStatus status={injurySaveStatus} />}
                    <button onClick={() => { setEditingInjury(null); setShowNewInjury(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                    <button onClick={saveInjury} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                      {editingInjury ? 'Done' : 'Record Injury'}
                    </button>
                  </div>
                </div>
              )}

              {injuries.length === 0 && !(showNewInjury || editingInjury) ? (
                <EmptyState icon={<ShieldAlert size={36} />} title="No injury records" description="Record injuries to track player health and recovery" action={{ label: 'Record Injury', onClick: openNewInjury }} />
              ) : (
                injuries.map(r => (
                  <div key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">{r.injuryType}</span>
                          {r.bodyPart && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{r.bodyPart}</span>}
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', SEVERITY_STYLES[r.severity])}>{r.severity}</span>
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', RECOVERY_STYLES[r.recoveryStatus])}>{r.recoveryStatus === 'FullyRecovered' ? 'Recovered' : r.recoveryStatus}</span>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Calendar size={11} /> {r.injuryDate.split('T')[0]}{r.expectedReturnDate ? ` → ${r.expectedReturnDate.split('T')[0]}` : ''}
                          {r.recoveredDate && <span className="text-green-500 ml-1">· recovered {r.recoveredDate.split('T')[0]}</span>}
                        </p>
                        {r.treatmentPlan && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5"><span className="font-semibold text-gray-500 dark:text-gray-400">Treatment:</span> {r.treatmentPlan}</p>}
                        {r.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex gap-1">
                          <button onClick={() => openEditInjury(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteInjuryTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                        {r.recoveryStatus !== 'FullyRecovered' && (
                          <button
                            onClick={async () => { try { await recoverInjury.mutateAsync(r.id); showToast('Marked recovered', 'success'); } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error'); } }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-all cursor-pointer whitespace-nowrap"
                          >
                            <ShieldAlert size={11} /> Mark Recovered
                          </button>
                        )}
                        <button
                          onClick={() => setRecoveryInjuryId(r.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Activity size={11} /> Recovery Program
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* Matches tab */}
          {tab === 'matches' && (
            <motion.div key="matches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="max-w-2xl space-y-4">
              {!(showNewMatch || editingMatch) && (
                <div className="flex justify-end">
                  <button onClick={openNewMatch} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
                    <Plus size={15} /> Record Match
                  </button>
                </div>
              )}

              {(showNewMatch || editingMatch) && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingMatch ? 'Edit Match' : 'Record Match'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Match Date" type="date" value={matchForm.matchDate} onChange={e => setMatchForm(v => ({ ...v, matchDate: e.target.value }))} />
                    <Input label="Opponent *" value={matchForm.opponent} onChange={e => setMatchForm(v => ({ ...v, opponent: e.target.value }))} placeholder="Opponent team name" />
                    <div className="sm:col-span-2">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Performance Rating</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{matchForm.performanceRating}/10</span>
                      </div>
                      <input type="range" min={1} max={10} step={1} value={matchForm.performanceRating}
                        onChange={e => setMatchForm(v => ({ ...v, performanceRating: e.target.value }))}
                        className="w-full accent-indigo-600 h-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sport-Specific Stats</label>
                      <textarea value={matchForm.sportSpecificStats} onChange={e => setMatchForm(v => ({ ...v, sportSpecificStats: e.target.value }))} rows={2} placeholder="Goals, assists, tackles…" className={TEXTAREA_CLS} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea value={matchForm.notes} onChange={e => setMatchForm(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Match observations…" className={TEXTAREA_CLS} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 mt-4">
                    {editingMatch && <AutoSaveStatus status={matchSaveStatus} />}
                    <button onClick={() => { setEditingMatch(null); setShowNewMatch(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                    <button onClick={saveMatch} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                      {editingMatch ? 'Done' : 'Record Match'}
                    </button>
                  </div>
                </div>
              )}

              {matches.length === 0 && !(showNewMatch || editingMatch) ? (
                <EmptyState icon={<Star size={36} />} title="No match records" description="Record match performances to track progress over time" action={{ label: 'Record Match', onClick: openNewMatch }} />
              ) : (
                matches.map(m => (
                  <div key={m.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-semibold text-gray-900 dark:text-white">vs {m.opponent}</span>
                        </div>
                        <RatingStars rating={m.performanceRating} />
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                          <Calendar size={11} /> {m.matchDate}
                        </p>
                        {m.sportSpecificStats && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{m.sportSpecificStats}</p>}
                        {m.notes && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 italic">{m.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditMatch(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteMatchTarget(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* Training tab */}
          {tab === 'training' && (
            <motion.div key="training" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="max-w-2xl space-y-4">
              {!(showNewSession || editingSession) && (
                <div className="flex justify-end">
                  <button onClick={openNewSession} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
                    <Plus size={15} /> Log Session
                  </button>
                </div>
              )}

              {(showNewSession || editingSession) && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingSession ? 'Edit Session' : 'Log Training Session'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Date" type="date" value={trainingForm.date} onChange={e => setTrainingForm(v => ({ ...v, date: e.target.value }))} />
                    <Input label="Duration (min)" type="number" value={trainingForm.durationMinutes} onChange={e => setTrainingForm(v => ({ ...v, durationMinutes: e.target.value }))} min={1} max={300} />
                    <Select label="Team *" value={trainingForm.teamId} onChange={e => setTrainingForm(v => ({ ...v, teamId: e.target.value }))} options={[{ value: '', label: 'Select team…' }, ...teams.map(t => ({ value: String(t.id), label: t.name }))]} />
                    <Select label="Attendance" value={trainingForm.attendanceStatus} onChange={e => setTrainingForm(v => ({ ...v, attendanceStatus: e.target.value }))} options={ATTENDANCE_STATUSES.map(s => ({ value: s, label: s }))} />
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea value={trainingForm.notes} onChange={e => setTrainingForm(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder="Session notes…" className={TEXTAREA_CLS} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 mt-4">
                    {editingSession && <AutoSaveStatus status={sessionSaveStatus} />}
                    <button onClick={() => { setEditingSession(null); setShowNewSession(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                    <button onClick={saveSession} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                      {editingSession ? 'Done' : 'Log Session'}
                    </button>
                  </div>
                </div>
              )}

              {sessions.length === 0 && !(showNewSession || editingSession) ? (
                <EmptyState icon={<Dumbbell size={36} />} title="No training sessions logged" description="Log training sessions to track attendance and progress" action={{ label: 'Log Session', onClick: openNewSession }} />
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><Clock size={14} /> {s.durationMinutes} min</span>
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ATTENDANCE_STYLES[s.attendanceStatus])}>{s.attendanceStatus}</span>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5"><Calendar size={11} /> {s.date}</p>
                        {s.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{s.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEditSession(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteSessionTarget(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* Tasks tab */}
          {tab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Assigned Tasks</h3>
                <button
                  onClick={() => { setEditTask(null); setTaskModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <Plus size={13} /> Assign Task
                </button>
              </div>
              {playerTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckSquare size={32} />}
                  title="No tasks assigned"
                  description="Assign a drill or task to this player."
                  size="sm"
                />
              ) : (
                <div className="space-y-3">
                  {playerTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onEdit={() => { setEditTask(t); setTaskModalOpen(true); }}
                      onDelete={() => setDeleteTaskTarget(t)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Wellbeing tab (coach view of athlete daily check-ins) */}
          {tab === 'wellbeing' && (
            <motion.div key="wellbeing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <WellbeingTrendCard playerId={playerId} />
            </motion.div>
          )}

          {/* Notes tab (coach-private) */}
          {tab === 'notes' && (
            <motion.div key="notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <CoachNotesTab playerId={playerId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AssignTaskModal
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditTask(null); }}
        players={player ? [{ id: player.id, name: player.fullName }] : []}
        task={editTask}
        lockedPlayerId={player?.id}
      />

      <RecoveryPlanModal
        isOpen={recoveryInjuryId != null}
        onClose={() => setRecoveryInjuryId(null)}
        injuryId={recoveryInjuryId ?? undefined}
        injuryBodyPart={injuries.find(i => i.id === recoveryInjuryId)?.bodyPart}
        isCoach
      />

      {/* Confirm modals */}
      <ConfirmModal isOpen={!!deleteTaskTarget} onClose={() => setDeleteTaskTarget(null)}
        onConfirm={async () => { if (!deleteTaskTarget) return; try { await deleteTask.mutateAsync(deleteTaskTarget.id); showToast('Task deleted', 'success'); } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteTaskTarget(null); } }}
        title="Delete Task" message={`Delete "${deleteTaskTarget?.title}"?`} confirmLabel="Delete" isLoading={deleteTask.isPending} />
      <ConfirmModal isOpen={!!deleteInjuryTarget} onClose={() => setDeleteInjuryTarget(null)}
        onConfirm={async () => { if (!deleteInjuryTarget) return; try { await deleteInjury.mutateAsync(deleteInjuryTarget.id); showToast('Injury deleted', 'success'); } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteInjuryTarget(null); } }}
        title="Delete Injury Record" message={`Delete "${deleteInjuryTarget?.injuryType}" record?`} confirmLabel="Delete" isLoading={deleteInjury.isPending} />
      <ConfirmModal isOpen={!!deleteMatchTarget} onClose={() => setDeleteMatchTarget(null)}
        onConfirm={async () => { if (!deleteMatchTarget) return; try { await deleteMatch.mutateAsync(deleteMatchTarget.id); showToast('Match deleted', 'success'); } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteMatchTarget(null); } }}
        title="Delete Match Record" message={`Delete match vs "${deleteMatchTarget?.opponent}"?`} confirmLabel="Delete" isLoading={deleteMatch.isPending} />
      <ConfirmModal isOpen={!!deleteSessionTarget} onClose={() => setDeleteSessionTarget(null)}
        onConfirm={async () => { if (!deleteSessionTarget) return; try { await deleteSession.mutateAsync(deleteSessionTarget.id); showToast('Session deleted', 'success'); } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteSessionTarget(null); } }}
        title="Delete Training Session" message="Delete this training session?" confirmLabel="Delete" isLoading={deleteSession.isPending} />
      <ConfirmModal isOpen={confirmDeletePlayer} onClose={() => setConfirmDeletePlayer(false)}
        onConfirm={async () => { try { await deletePlayer.mutateAsync(playerId); showToast('Player deleted', 'success'); navigate('/players'); } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setConfirmDeletePlayer(false); } }}
        title="Delete Player" message={`Permanently delete ${player.fullName}? This cannot be undone.`} confirmLabel="Delete" isLoading={deletePlayer.isPending} />
    </motion.div>
  );
}
