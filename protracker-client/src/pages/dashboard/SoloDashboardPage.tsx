import { useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity, CalendarDays, CheckSquare, ChevronRight, ClipboardList, Clock, Dumbbell,
  Flame, MapPin, Pencil, Salad, Sparkles, Target, TrendingUp, Trophy, Users, X, Library,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { useMyTasks } from '../../hooks/useTasks';
import { useSoloProfile, useSoloSessions, useSoloMatches, useUpdateSoloProfile } from '../../hooks/useSolo';
import { useMyWellbeing } from '../../hooks/useWellbeing';
import { WellbeingCheckinWidget } from '../../components/wellbeing/WellbeingCheckinWidget';
import { ConnectCoachModal } from '../../components/solo/ConnectCoachModal';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { Sparkline } from '../../components/charts/Sparkline';
import { StatCard } from '../../components/dashboard/StatCard';
import { CountUp } from '../../components/ui/CountUp';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { ShareProgressButton } from '../../components/profile/ShareProgressButton';
import { GoalsMiniCard } from '../../components/goals/GoalsMiniCard';
import { JournalPromptCard } from '../../components/journal/JournalPromptCard';
import { MyNotesCard } from '../../components/athleteNotes/MyNotesCard';
import { MyLeaguesCard } from '../../components/leagues/MyLeaguesCard';
import { ProgressThisMonthCard } from '../../components/journal/ProgressThisMonthCard';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.06 },
  }),
};

const SPORT_EMOJIS: Record<number, string> = { 1: '⚽', 2: '🏀', 3: '🏐', 4: '🏖️', 5: '🎾' };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Consecutive "active days" (session, match, check-in or assessment) ending today
// or yesterday — a streak shouldn't reset while today is still in progress.
function computeStreak(dates: Date[]): number {
  const days = new Set(dates.map(dayKey));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function SoloDashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fmt = useLocaleFormat();
  const L = useDynamicLabels();
  const navigate = useNavigate();
  const FREQUENCY_LABELS: Record<string, string> = {
    Daily: t('dashboard.freqDaily', 'Trains daily'),
    FewTimesWeek: t('dashboard.freqFewTimesWeek', 'A few times a week'),
    Weekly: t('dashboard.freqWeekly', 'Trains weekly'),
    Occasionally: t('dashboard.freqOccasionally', 'Trains occasionally'),
  };
  const greeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.goodMorning', 'Good morning');
    if (h < 18) return t('dashboard.goodAfternoon', 'Good afternoon');
    return t('dashboard.goodEvening', 'Good evening');
  };
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data, isLoading, isError, refetch } = usePlayerDashboard(playerId);
  const { data: assessments = [] } = usePlayerAssessments(playerId);
  const { data: tasks = [] } = useMyTasks();
  const { data: soloProfile } = useSoloProfile();
  const { data: sessions = [] } = useSoloSessions();
  const { data: matches = [] } = useSoloMatches();
  const { data: wellbeing = [] } = useMyWellbeing();
  const updateProfile = useUpdateSoloProfile();

  // One-time welcome banner set by the solo registration wizard.
  const [welcome, setWelcome] = useState<{ name: string; sport: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem('pt_welcome_solo');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const dismissWelcome = () => {
    sessionStorage.removeItem('pt_welcome_solo');
    setWelcome(null);
  };

  const [editingGoals, setEditingGoals] = useState(false);
  const [goalsDraft, setGoalsDraft] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinBannerDismissed, setJoinBannerDismissed] = useState(() => localStorage.getItem('pt_solo_join_banner') === 'dismissed');
  const dismissJoinBanner = () => {
    localStorage.setItem('pt_solo_join_banner', 'dismissed');
    setJoinBannerDismissed(true);
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekStart = useMemo(() => {
    const d = new Date();
    const diff = (d.getDay() + 6) % 7; // Monday-based
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const streak = useMemo(() => computeStreak([
    ...sessions.filter(s => new Date(s.startTime) <= new Date()).map(s => new Date(s.startTime)),
    ...matches.map(m => new Date(m.matchDate)),
    ...wellbeing.map(w => new Date(w.date)),
    ...assessments.map(a => new Date(a.dateRecorded)),
  ]), [sessions, matches, wellbeing, assessments]);

  if (loadingId || isLoading) return <DashboardSkeleton />;
  if (isError)
    return (
      <PageWrapper>
        <ErrorState thing="your dashboard" onRetry={() => refetch()} />
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Athlete';
  const player = data?.player;
  const sportEmoji = SPORT_EMOJIS[player?.sportId ?? 0] ?? '🏅';
  const avgScore = data?.latestAverageScore;

  const assessmentsThisMonth = assessments.filter(a => new Date(a.dateRecorded) >= monthStart).length;
  const tasksDoneThisWeek = tasks.filter(t => t.isCompleted && t.completedAt && new Date(t.completedAt) >= weekStart).length;
  const sessionsThisMonth = sessions.filter(s => new Date(s.startTime) >= monthStart && new Date(s.startTime) <= now).length;

  const upcomingSessions = sessions
    .filter(s => new Date(s.startTime) >= now && new Date(s.startTime) <= weekAhead)
    .slice(0, 4);
  const tasksDueThisWeek = tasks
    .filter(t => !t.isCompleted && (!t.dueDate || new Date(t.dueDate) <= weekAhead))
    .slice(0, 4);

  // Last 5 assessments (oldest → newest) as average scores for the mini trend chart.
  const progressData = [...assessments]
    .sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime())
    .slice(-5)
    .map(a => ({
      name: new Date(a.dateRecorded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: a.statScores.length ? Math.round((a.statScores.reduce((sum, s) => sum + s.score, 0) / a.statScores.length) * 10) / 10 : 0,
    }));

  const quickActions = [
    { label: t('dashboard.logAssessment', 'Log Assessment'), desc: t('dashboard.logAssessmentDesc', 'Track your performance today'), icon: ClipboardList, path: '/solo/assessment', gradient: 'from-indigo-500 to-blue-600', shadow: 'hover:shadow-indigo-500/25' },
    { label: t('dashboard.generateNutritionPlan', 'Generate Nutrition Plan'), desc: t('dashboard.generateNutritionPlanDesc', 'Get an AI meal plan for this week'), icon: Salad, path: '/solo/nutrition', gradient: 'from-emerald-500 to-green-600', shadow: 'hover:shadow-emerald-500/25' },
    { label: t('dashboard.logTrainingSession', 'Log Training Session'), desc: t('dashboard.logTrainingSessionDesc', "Record today's training"), icon: Dumbbell, path: '/solo/training', gradient: 'from-purple-500 to-violet-600', shadow: 'hover:shadow-purple-500/25' },
    { label: t('dashboard.logMatch', 'Log Match'), desc: t('dashboard.logMatchDesc', 'Record a match result'), icon: Trophy, path: '/solo/matches', gradient: 'from-amber-500 to-orange-600', shadow: 'hover:shadow-amber-500/25' },
    { label: t('dashboard.browseDrills', 'Browse Drills'), desc: t('dashboard.browseDrillsDesc', 'Find drills to work on'), icon: Library, path: '/solo/drills', gradient: 'from-teal-500 to-cyan-600', shadow: 'hover:shadow-teal-500/25' },
  ];

  const startEditGoals = () => {
    setGoalsDraft(soloProfile?.goals ?? '');
    setEditingGoals(true);
  };
  const saveGoals = () => {
    updateProfile.mutate({ goals: goalsDraft }, { onSuccess: () => setEditingGoals(false) });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 p-4 lg:p-6 space-y-6"
    >
      {/* Welcome banner (shown once after solo registration) */}
      {welcome && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/15 flex-shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="font-black text-lg leading-tight">{t('dashboard.welcomeToProTracker', 'Welcome to ProTracker, {{name}}!', { name: welcome.name.split(' ')[0] })} 🎉</p>
                <p className="text-indigo-100 text-sm mt-0.5">{t('dashboard.welcomeSoloDesc', "You're all set to start tracking your {{sport}} performance.", { sport: welcome.sport })}</p>
              </div>
            </div>
            <button onClick={dismissWelcome} aria-label={t('dashboard.dismiss', 'Dismiss')} className="text-white/70 hover:text-white cursor-pointer text-lg leading-none px-1">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Hero greeting */}
      <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black tracking-tight">{greeting()}, {firstName}!</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">
                  {sportEmoji} {soloProfile?.sportName ? L.sport(soloProfile.sportName) : player?.positionName ?? t('dashboard.athlete', 'Athlete')}
                </span>
                {soloProfile?.skillLevel && (
                  <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">{L.difficulty(soloProfile.skillLevel)}</span>
                )}
                {soloProfile?.trainingFrequency && (
                  <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold hidden sm:inline-block">
                    {FREQUENCY_LABELS[soloProfile.trainingFrequency]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2.5">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/20 px-4 py-2.5">
                <Flame size={20} className={streak > 0 ? 'text-orange-300' : 'text-white/50'} />
                <div>
                  <p className="text-xl font-black leading-none">{streak}</p>
                  <p className="text-[10px] text-indigo-100 uppercase tracking-wide font-semibold mt-0.5">{t('dashboard.dayStreak', 'day streak')}</p>
                </div>
              </div>
              <ShareProgressButton />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <StatCard
            title={t('dashboard.latestScore', 'Latest Score')}
            icon={Activity}
            gradient="from-emerald-500 to-green-600"
            valueNode={
              avgScore != null ? (
                <CountUp
                  value={avgScore}
                  decimals={1}
                  className={clsx(
                    'text-3xl font-black mt-0.5 block tabular-nums',
                    avgScore < 5 ? 'text-red-500' : avgScore < 7 ? 'text-amber-500' : 'text-green-500',
                  )}
                />
              ) : (
                <div>
                  <p className="text-3xl font-black text-gray-400 mt-0.5">—</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t('dashboard.noAssessmentsYet', 'No assessments yet')}</p>
                </div>
              )
            }
            footer={progressData.length >= 2 ? <Sparkline values={progressData.map(p => p.score)} width={72} height={26} className="mb-1" /> : undefined}
          />
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
          <StatCard
            title={t('dashboard.assessmentsThisMonth', 'Assessments This Month')}
            value={assessmentsThisMonth}
            icon={ClipboardList}
            gradient="from-indigo-500 to-blue-600"
          />
        </motion.div>
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}>
          <StatCard
            title={t('dashboard.tasksDoneThisWeek', 'Tasks Done This Week')}
            value={tasksDoneThisWeek}
            icon={CheckSquare}
            gradient="from-emerald-500 to-teal-600"
          />
        </motion.div>
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}>
          <StatCard
            title={t('dashboard.sessionsThisMonth', 'Sessions This Month')}
            value={sessionsThisMonth}
            icon={Dumbbell}
            gradient="from-purple-500 to-violet-600"
          />
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">{t('dashboard.quickActions', 'Quick Actions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={clsx(
                'relative overflow-hidden group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer text-left',
                item.gradient,
                item.shadow,
              )}
            >
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="p-3 rounded-xl bg-white/15 flex-shrink-0">
                <item.icon size={22} />
              </div>
              <div className="flex-1 min-w-0 relative">
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-xs text-white/75 mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-white/70 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Progress this month */}
      <motion.div custom={5.3} initial="hidden" animate="show" variants={fadeUp}>
        <ProgressThisMonthCard />
      </motion.div>

      {/* Goals + journal at-a-glance */}
      <motion.div custom={5.6} initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GoalsMiniCard goalsPath="/solo/goals" />
        <JournalPromptCard journalPath="/solo/journal" />
      </motion.div>

      {/* My leagues */}
      <motion.div custom={5.65} initial="hidden" animate="show" variants={fadeUp}>
        <MyLeaguesCard />
      </motion.div>

      {/* Private notes */}
      <motion.div custom={5.7} initial="hidden" animate="show" variants={fadeUp}>
        <MyNotesCard notesPath="/solo/notes" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Progress */}
        <motion.div custom={6} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
              <TrendingUp size={16} className="text-indigo-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">{t('dashboard.myProgress', 'My Progress')}</h2>
          </div>
          {progressData.length >= 2 ? (
            <LineChartWrapper
              data={progressData}
              series={[{ key: 'score', name: t('dashboard.avgScore', 'Avg Score'), color: '#6366f1' }]}
              height={220}
            />
          ) : (
            <EmptyState
              icon={<TrendingUp size={32} />}
              title={t('dashboard.noTrendYet', 'No trend yet')}
              description={t('dashboard.noTrendDesc', 'Log at least two assessments to see your progress curve here.')}
              size="sm"
            />
          )}
        </motion.div>

        {/* This Week */}
        <motion.div custom={7} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex p-2 rounded-xl bg-purple-500/10">
              <CalendarDays size={16} className="text-purple-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">{t('dashboard.thisWeek', 'This Week')}</h2>
          </div>

          {upcomingSessions.length === 0 && tasksDueThisWeek.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={32} />}
              title={t('dashboard.nothingScheduled', 'Nothing scheduled')}
              description={t('dashboard.nothingScheduledDesc', 'Plan a training session or set yourself a task to fill this week.')}
              size="sm"
            />
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((s) => {
                const start = new Date(s.startTime);
                return (
                  <div key={`s-${s.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <span className="text-[9px] font-semibold uppercase leading-none">{fmt.formatDate(start, { month: 'short' })}</span>
                      <span className="text-base font-black leading-none mt-0.5">{start.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.title}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmt.formatTime(start)} · {s.durationMinutes}m</span>
                        {s.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {s.location}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {tasksDueThisWeek.map((task) => (
                <div key={`t-${task.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className={clsx(
                    'flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
                    task.priority === 'High' ? 'bg-red-500/10 text-red-500' : task.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500',
                  )}>
                    <CheckSquare size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{task.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {task.dueDate ? `${t('dashboard.due', 'Due')} ${fmt.formatDate(task.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}` : t('dashboard.noDueDate', 'No due date')} · {L.priority(task.priority)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Daily wellbeing check-in */}
      <motion.div custom={8} initial="hidden" animate="show" variants={fadeUp}>
        <WellbeingCheckinWidget />
      </motion.div>

      {/* Goals */}
      <motion.div custom={9} initial="hidden" animate="show" variants={fadeUp}
        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex p-2 rounded-xl bg-amber-500/10">
              <Target size={16} className="text-amber-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">{t('dashboard.myGoals', 'My Goals')}</h2>
          </div>
          {!editingGoals && (
            <button onClick={startEditGoals}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer">
              <Pencil size={12} /> {t('dashboard.editGoals', 'Edit Goals')}
            </button>
          )}
        </div>
        {editingGoals ? (
          <div className="space-y-3">
            <textarea
              value={goalsDraft}
              onChange={e => setGoalsDraft(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('dashboard.goalsPlaceholder', 'What do you want to improve?')}
              className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3.5 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveGoals} disabled={updateProfile.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer">
                {updateProfile.isPending ? t('common.saving', 'Saving…') : t('dashboard.saveGoals', 'Save Goals')}
              </button>
              <button onClick={() => setEditingGoals(false)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold cursor-pointer">
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        ) : soloProfile?.goals ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{soloProfile.goals}</p>
        ) : (
          <p className="text-sm text-gray-400">{t('dashboard.noGoalsSet', "No goals set yet — write down what you're working towards.")}</p>
        )}
        {!editingGoals && soloProfile?.motivation && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">"{soloProfile.motivation}"</p>
        )}
      </motion.div>

      {/* Join-a-team nudge (dismissible) */}
      {!joinBannerDismissed && (
        <motion.div custom={10} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="inline-flex p-2 rounded-xl bg-indigo-500/10 flex-shrink-0">
                <Users size={16} className="text-indigo-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('dashboard.trainingSolo', 'Training solo?')} <span className="font-semibold text-gray-900 dark:text-white">{t('dashboard.joinATeam', 'Join a team')}</span> {t('dashboard.joinTeamRest', 'to get personalized coaching — your history comes with you.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setJoinOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer">
                {t('dashboard.enterJoinCode', 'Enter Join Code')}
              </button>
              <button onClick={dismissJoinBanner} aria-label={t('dashboard.dismiss', 'Dismiss')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <ConnectCoachModal isOpen={joinOpen} onClose={() => setJoinOpen(false)} />
    </motion.div>
  );
}
