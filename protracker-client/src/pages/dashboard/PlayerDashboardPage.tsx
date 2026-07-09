import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { usePlayerMatchRatings } from '../../hooks/useMatches';
import { statFieldsForFormat, parseStatJson } from '../../utils/matchSport';
import { useMySessions } from '../../hooks/useSessions';
import { SessionsToRateCard } from '../../components/sessions/SessionsToRateCard';
import { MyNotesCard } from '../../components/athleteNotes/MyNotesCard';
import { useMyAnnouncements } from '../../hooks/useAnnouncements';
import { useCoachNotes } from '../../hooks/useCoachNotes';
import { usePlayerRecoveryPlan } from '../../hooks/useRecovery';
import { RecoveryPlanModal } from '../../components/recovery/RecoveryPlanModal';
import { WellbeingCheckinWidget } from '../../components/wellbeing/WellbeingCheckinWidget';
import { ShareProgressButton } from '../../components/profile/ShareProgressButton';
import { GoalsMiniCard } from '../../components/goals/GoalsMiniCard';
import { JournalPromptCard } from '../../components/journal/JournalPromptCard';
import { OnboardingModal } from '../../components/profile/OnboardingModal';
import { ProfileCompletionReminder } from '../../components/profile/ProfileCompletionReminder';
import { useProfile } from '../../hooks/useProfile';
import { usePlayerNutritionProfile } from '../../hooks/useNutrition';
import { computeProfileCompletion } from '../../utils/profileCompletion';
import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useAuth } from '../../context/AuthContext';
import {
  Activity, ClipboardList, TrendingUp, Salad, ChevronRight,
  Zap, Star, Target, Shield, Trophy, CalendarDays, Clock, MapPin,
  Megaphone, Pin, MessageCircle,
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
  const { data, isLoading, isError, refetch } = usePlayerDashboard(playerId);
  const { data: matchRatings } = usePlayerMatchRatings(playerId);
  const { data: upcomingSessions } = useMySessions();
  const { data: announcements } = useMyAnnouncements();
  const { data: coachFeedback } = useCoachNotes(playerId);
  const { data: recoveryPlan } = usePlayerRecoveryPlan(playerId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const { data: profile } = useProfile();
  const { data: dietaryItems = [] } = usePlayerNutritionProfile(playerId ?? 0);

  // One-time welcome banner set by the join-code registration flow.
  const [welcome, setWelcome] = useState<{ team: string; name: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem('pt_welcome');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const dismissWelcome = () => {
    sessionStorage.removeItem('pt_welcome');
    setWelcome(null);
  };

  if (loadingId || isLoading) return <DashboardSkeleton />;
  if (isError)
    return (
      <PageWrapper>
        <ErrorState thing="your dashboard" onRetry={() => refetch()} />
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Athlete';
  const latestAssessment = data?.recentAssessments?.[0];
  const radarData = latestAssessment?.statScores?.map((s) => ({
    subject: s.statCategoryName,
    value: s.score,
  })) ?? [];

  const avgScore = data?.latestAverageScore;

  // Onboarding + completion reminder (Feature: athlete onboarding improvements)
  const completion = profile ? computeProfileCompletion(profile, { dietaryCount: dietaryItems.length }) : null;
  const showOnboarding = !!profile && !profile.hasCompletedOnboarding && (completion?.percent ?? 100) < 50;

  const latestScores = latestAssessment?.statScores ?? [];
  const bestStat = latestScores.length
    ? latestScores.reduce((best, s) => (s.score > best.score ? s : best))
    : null;
  const worstStat = latestScores.length
    ? latestScores.reduce((worst, s) => (s.score < worst.score ? s : worst))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex-1 p-4 lg:p-6 space-y-6"
    >
      {/* First-login onboarding (photo → physicals → dietary) */}
      {showOnboarding && <OnboardingModal profile={profile!} />}

      {/* Profile completion nudge (< 80%, dismissible for 7 days) */}
      {!showOnboarding && profile?.hasCompletedOnboarding && completion && (
        <ProfileCompletionReminder completion={completion} />
      )}

      {/* Welcome banner (shown once after joining via a team code) */}
      {welcome && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white/15 flex-shrink-0">
                <Trophy size={18} />
              </div>
              <div>
                <p className="font-black text-lg leading-tight">Welcome to {welcome.team}, {welcome.name.split(' ')[0]}! 🎉</p>
                <p className="text-emerald-100 text-sm mt-0.5">Your coach has been notified. Your profile is set up — assessments and tasks will appear here.</p>
              </div>
            </div>
            <button onClick={dismissWelcome} aria-label="Dismiss" className="text-white/70 hover:text-white cursor-pointer text-lg leading-none px-1">×</button>
          </div>
        </motion.div>
      )}

      {/* Hero greeting */}
      <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-200 text-sm mb-2">
                <Zap size={14} />
                Ready to train?
              </div>
              <h1 className="text-2xl font-black tracking-tight">Hi, {firstName}</h1>
              <p className="text-indigo-200 text-sm mt-1">Keep pushing — your next level is within reach.</p>
            </div>
            <ShareProgressButton />
          </div>
        </div>
      </motion.div>

      {/* Daily wellbeing check-in */}
      <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
        <WellbeingCheckinWidget />
      </motion.div>

      {/* Goals + journal at-a-glance */}
      <motion.div custom={1.5} initial="hidden" animate="show" variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GoalsMiniCard goalsPath="/player-dashboard/goals" />
        <JournalPromptCard journalPath="/player-dashboard/journal" />
      </motion.div>

      {/* Private notes */}
      <motion.div custom={1.6} initial="hidden" animate="show" variants={fadeUp}>
        <MyNotesCard notesPath="/player-dashboard/notes" />
      </motion.div>

      {/* Team Announcements */}
      {announcements && announcements.length > 0 && (
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
              <Megaphone size={16} className="text-indigo-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">Team Announcements</h2>
          </div>
          <div className="space-y-2">
            {announcements.slice(0, 4).map((a) => {
              const border = a.priority === 'Urgent' ? 'border-red-300 dark:border-red-800'
                : a.priority === 'Important' ? 'border-amber-300 dark:border-amber-800'
                : 'border-gray-100 dark:border-gray-800';
              const badge = a.priority === 'Urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : a.priority === 'Important' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
              return (
                <div key={a.id} className={clsx('rounded-xl border p-3', border)}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.isPinned && <Pin size={12} className="text-indigo-500 flex-shrink-0" />}
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.title}</p>
                    </div>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', badge)}>{a.priority}</span>
                  </div>
                  {a.content && <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{a.content}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{a.teamName} · {a.coachName || 'Coach'}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recovery Program */}
      {recoveryPlan && (
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <button onClick={() => setRecoveryOpen(true)}
            className="w-full text-left rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-900/10 p-5 hover:border-rose-300 dark:hover:border-rose-800 transition-all cursor-pointer">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="inline-flex p-2.5 rounded-xl bg-rose-500/10">
                  <Activity size={18} className="text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{recoveryPlan.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Week {recoveryPlan.currentWeek} of {recoveryPlan.estimatedWeeks} · {recoveryPlan.injuryType}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-rose-500">
                  {recoveryPlan.totalExercises > 0 ? Math.round((recoveryPlan.completedExercises / recoveryPlan.totalExercises) * 100) : 0}%
                </p>
                <p className="text-[11px] text-gray-500">{recoveryPlan.completedExercises}/{recoveryPlan.totalExercises} exercises</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${recoveryPlan.totalExercises > 0 ? Math.round((recoveryPlan.completedExercises / recoveryPlan.totalExercises) * 100) : 0}%` }} />
            </div>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-2">View recovery program →</p>
          </button>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="inline-flex p-2 rounded-xl bg-amber-500/10 mb-3">
            <Star size={16} className="text-amber-500" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Best Category</p>
          {bestStat ? (
            <>
              <p className="text-xl font-black text-amber-500 mt-0.5">{bestStat.score.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{bestStat.statCategoryName}</p>
            </>
          ) : (
            <p className="text-3xl font-black text-gray-400 mt-0.5">—</p>
          )}
        </motion.div>
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="inline-flex p-2 rounded-xl bg-red-500/10 mb-3">
            <Target size={16} className="text-red-400" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Needs Work</p>
          {worstStat ? (
            <>
              <p className="text-xl font-black text-red-400 mt-0.5">{worstStat.score.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{worstStat.statCategoryName}</p>
            </>
          ) : (
            <p className="text-3xl font-black text-gray-400 mt-0.5">—</p>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}
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
        <motion.div custom={6} initial="hidden" animate="show" variants={fadeUp}
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

      {/* Rate past sessions */}
      <motion.div custom={7} initial="hidden" animate="show" variants={fadeUp}>
        <SessionsToRateCard />
      </motion.div>

      {/* Upcoming Sessions */}
      {upcomingSessions && upcomingSessions.length > 0 && (
        <motion.div custom={7} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
              <CalendarDays size={16} className="text-indigo-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">Upcoming Sessions</h2>
          </div>
          <div className="space-y-2">
            {upcomingSessions.slice(0, 5).map((s) => {
              const start = new Date(s.startTime);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <span className="text-[10px] font-semibold uppercase leading-none">{start.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none mt-0.5">{start.getDate()}</span>
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
          </div>
        </motion.div>
      )}

      {/* My Matches */}
      {matchRatings && matchRatings.length > 0 && (
        <motion.div custom={8} initial="hidden" animate="show" variants={fadeUp}
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex p-2 rounded-xl bg-emerald-500/10">
              <Trophy size={16} className="text-emerald-500" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">My Matches</h2>
          </div>
          <div className="space-y-2">
            {matchRatings.slice(0, 6).map((r) => {
              const ratingColor = r.rating < 5 ? 'text-red-500 bg-red-500/10'
                : r.rating < 7 ? 'text-amber-500 bg-amber-500/10'
                : 'text-green-500 bg-green-500/10';
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className={clsx('flex flex-col items-center justify-center w-12 h-12 rounded-xl font-black flex-shrink-0', ratingColor)}>
                    <span className="text-lg leading-none">{r.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">vs {r.opponentName ?? 'Opponent'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {r.matchDate ? new Date(r.matchDate).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                    {(() => {
                      const parsed = parseStatJson(r.statJson);
                      const legacy = r as unknown as Record<string, number>;
                      const val = (k: string) => (k in parsed ? parsed[k] : (typeof legacy[k] === 'number' ? legacy[k] : 0));
                      return statFieldsForFormat(r.scoreFormat)
                        .filter(f => val(f.key) > 0)
                        .slice(0, 3)
                        .map(f => <span key={f.key} className="font-medium">{f.label} {val(f.key)}</span>);
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Coach Feedback (shared notes) */}
      <motion.div custom={9} initial="hidden" animate="show" variants={fadeUp}
        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex p-2 rounded-xl bg-green-500/10">
            <MessageCircle size={16} className="text-green-500" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">Coach Feedback</h2>
        </div>
        {!coachFeedback || coachFeedback.length === 0 ? (
          <EmptyState icon={<MessageCircle size={32} />} title="No feedback yet"
            description="Your coach hasn't shared any feedback yet. Keep working hard!" size="sm" />
        ) : (
          <div className="space-y-2">
            {coachFeedback.slice(0, 6).map((n) => (
              <div key={n.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">{n.category}</span>
                  <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.content}</p>
                <p className="text-[11px] text-gray-400 mt-1">{n.coachName || 'Coach'}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick nav */}
      <motion.div custom={10} initial="hidden" animate="show" variants={fadeUp}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'My Stats', desc: 'Full assessment history', icon: TrendingUp, path: '/player-dashboard/stats', color: 'text-indigo-500 bg-indigo-500/10' },
            { label: 'My Nutrition', desc: 'Meal plans & dietary profile', icon: Salad, path: '/player-dashboard/nutrition', color: 'text-green-500 bg-green-500/10' },
            { label: 'My Plan', desc: 'Training & improvement', icon: Activity, path: '/player-dashboard/improvement', color: 'text-purple-500 bg-purple-500/10' },
            ...(data?.player?.teamId ? [{ label: 'My Team', desc: 'Team roster & skill profile', icon: Shield, path: `/player-dashboard/team/${data.player.teamId}`, color: 'text-orange-500 bg-orange-500/10' }] : []),
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

      <RecoveryPlanModal
        isOpen={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        playerId={playerId ?? undefined}
        isCoach={false}
      />
    </motion.div>
  );
}
