import { useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { ShareProgressButton } from '../../components/profile/ShareProgressButton';
import { GoalsMiniCard } from '../../components/goals/GoalsMiniCard';
import { JournalPromptCard } from '../../components/journal/JournalPromptCard';
import { MyNotesCard } from '../../components/athleteNotes/MyNotesCard';
import { ProgressThisMonthCard } from '../../components/journal/ProgressThisMonthCard';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.06 },
  }),
};

const SPORT_EMOJIS: Record<number, string> = { 1: '⚽', 2: '🏀', 3: '🏐', 4: '🏖️', 5: '🎾' };

const FREQUENCY_LABELS: Record<string, string> = {
  Daily: 'Trains daily',
  FewTimesWeek: 'A few times a week',
  Weekly: 'Trains weekly',
  Occasionally: 'Trains occasionally',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

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
  const navigate = useNavigate();
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
    { label: 'Log Assessment', desc: 'Track your performance today', icon: ClipboardList, path: '/solo/assessment', color: 'text-indigo-500 bg-indigo-500/10' },
    { label: 'Generate Nutrition Plan', desc: 'Get an AI meal plan for this week', icon: Salad, path: '/solo/nutrition', color: 'text-green-500 bg-green-500/10' },
    { label: 'Log Training Session', desc: "Record today's training", icon: Dumbbell, path: '/solo/training', color: 'text-purple-500 bg-purple-500/10' },
    { label: 'Log Match', desc: 'Record a match result', icon: Trophy, path: '/solo/matches', color: 'text-amber-500 bg-amber-500/10' },
    { label: 'Browse Drills', desc: 'Find drills to work on', icon: Library, path: '/solo/drills', color: 'text-teal-500 bg-teal-500/10' },
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
                <p className="font-black text-lg leading-tight">Welcome to ProTracker, {welcome.name.split(' ')[0]}! 🎉</p>
                <p className="text-indigo-100 text-sm mt-0.5">You're all set to start tracking your {welcome.sport} performance.</p>
              </div>
            </div>
            <button onClick={dismissWelcome} aria-label="Dismiss" className="text-white/70 hover:text-white cursor-pointer text-lg leading-none px-1">
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
                  {sportEmoji} {soloProfile?.sportName ?? player?.positionName ?? 'Athlete'}
                </span>
                {soloProfile?.skillLevel && (
                  <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold">{soloProfile.skillLevel}</span>
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
                  <p className="text-[10px] text-indigo-100 uppercase tracking-wide font-semibold mt-0.5">day streak</p>
                </div>
              </div>
              <ShareProgressButton />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="inline-flex p-2 rounded-xl bg-green-500/10 mb-3">
            <Activity size={16} className="text-green-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest Score</p>
          <p className={clsx(
            'text-3xl font-black mt-0.5',
            avgScore == null ? 'text-gray-400' : avgScore < 5 ? 'text-red-500' : avgScore < 7 ? 'text-amber-500' : 'text-green-500'
          )}>
            {avgScore != null ? avgScore.toFixed(1) : '—'}
          </p>
          {avgScore == null && <p className="text-[11px] text-gray-400 mt-0.5">No assessments yet</p>}
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10 mb-3">
            <ClipboardList size={16} className="text-indigo-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Assessments This Month</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">{assessmentsThisMonth}</p>
        </motion.div>
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="inline-flex p-2 rounded-xl bg-emerald-500/10 mb-3">
            <CheckSquare size={16} className="text-emerald-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tasks Done This Week</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">{tasksDoneThisWeek}</p>
        </motion.div>
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="inline-flex p-2 rounded-xl bg-purple-500/10 mb-3">
            <Dumbbell size={16} className="text-purple-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sessions This Month</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white mt-0.5">{sessionsThisMonth}</p>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="group flex items-center gap-4 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all cursor-pointer text-left"
            >
              <div className={clsx('p-3 rounded-xl flex-shrink-0', item.color)}>
                <item.icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
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
            <h2 className="font-bold text-gray-900 dark:text-white">My Progress</h2>
          </div>
          {progressData.length >= 2 ? (
            <LineChartWrapper
              data={progressData}
              series={[{ key: 'score', name: 'Avg score', color: '#6366f1' }]}
              height={220}
            />
          ) : (
            <EmptyState
              icon={<TrendingUp size={32} />}
              title="No trend yet"
              description="Log at least two assessments to see your progress curve here."
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
            <h2 className="font-bold text-gray-900 dark:text-white">This Week</h2>
          </div>

          {upcomingSessions.length === 0 && tasksDueThisWeek.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={32} />}
              title="Nothing scheduled"
              description="Plan a training session or set yourself a task to fill this week."
              size="sm"
            />
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((s) => {
                const start = new Date(s.startTime);
                return (
                  <div key={`s-${s.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex-shrink-0">
                      <span className="text-[9px] font-semibold uppercase leading-none">{start.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-base font-black leading-none mt-0.5">{start.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.title}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Clock size={11} /> {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {s.durationMinutes}m</span>
                        {s.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {s.location}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {tasksDueThisWeek.map((t) => (
                <div key={`t-${t.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className={clsx(
                    'flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0',
                    t.priority === 'High' ? 'bg-red-500/10 text-red-500' : t.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500',
                  )}>
                    <CheckSquare size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'No due date'} · {t.priority}
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
            <h2 className="font-bold text-gray-900 dark:text-white">My Goals</h2>
          </div>
          {!editingGoals && (
            <button onClick={startEditGoals}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer">
              <Pencil size={12} /> Edit Goals
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
              placeholder="What do you want to improve?"
              className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3.5 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveGoals} disabled={updateProfile.isPending}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer">
                {updateProfile.isPending ? 'Saving…' : 'Save Goals'}
              </button>
              <button onClick={() => setEditingGoals(false)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        ) : soloProfile?.goals ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{soloProfile.goals}</p>
        ) : (
          <p className="text-sm text-gray-400">No goals set yet — write down what you're working towards.</p>
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
                Training solo? <span className="font-semibold text-gray-900 dark:text-white">Join a team</span> to get personalized coaching — your history comes with you.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setJoinOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer">
                Enter Join Code
              </button>
              <button onClick={dismissJoinBanner} aria-label="Dismiss"
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
