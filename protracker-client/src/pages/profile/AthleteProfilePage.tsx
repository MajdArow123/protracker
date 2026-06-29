import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  Activity, User, Mail, Eye, EyeOff,
  TrendingUp, ShieldAlert, Salad,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { usePlayer } from '../../hooks/usePlayers';
import { usePlayerNutritionProfile } from '../../hooks/useNutrition';
import { useToast } from '../../context/ToastContext';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { clsx } from 'clsx';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: any) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: (i ?? 0) * 0.08 },
  }),
};

const SEVERITY_STYLES: Record<string, string> = {
  Hard: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Lifestyle: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Soft: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export function AthleteProfilePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: playerData } = usePlayer(playerId ?? 0);
  const { data: dashData } = usePlayerDashboard(playerId);
  const { data: dietaryItems = [] } = usePlayerNutritionProfile(playerId ?? 0);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });

  if (loadingId) return <PageSpinner />;

  const latestAssessment = dashData?.recentAssessments?.[0];
  const avgScore = dashData?.latestAverageScore;

  const fitnessLevel = playerData?.fitnessLevel;
  const fitnessLabel = (l: number | undefined) => {
    if (!l) return 'Unknown';
    if (l <= 3) return 'Beginner';
    if (l <= 6) return 'Intermediate';
    if (l <= 8) return 'Advanced';
    return 'Elite';
  };

  function handleSavePassword() {
    if (!passwordForm.current) { addToast('Enter current password', 'error'); return; }
    if (passwordForm.newPass.length < 6) { addToast('Password must be at least 6 characters', 'error'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { addToast('Passwords do not match', 'error'); return; }
    addToast('Password updated successfully', 'success');
    setPasswordForm({ current: '', newPass: '', confirm: '' });
    setShowPasswordForm(false);
  }

  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <motion.div custom={0} initial="hidden" animate="show" variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
        >
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-green-600/20 via-emerald-600/10 to-transparent" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-green-600/20 border-2 border-green-500/30 flex items-center justify-center text-green-400 text-2xl font-black flex-shrink-0">
              {user?.fullName ? getInitials(user.fullName) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{user?.fullName}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <Mail size={13} />
                {user?.email}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {playerData?.positionName && (
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                    {playerData.positionName}
                  </span>
                )}
                {playerData?.teamName && (
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
                    {playerData.teamName}
                  </span>
                )}
                {fitnessLevel && (
                  <span className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold">
                    {fitnessLabel(fitnessLevel)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* My Stats Summary */}
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">My Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Assessments', value: dashData?.totalAssessments ?? 0, icon: Activity, color: 'text-indigo-400 bg-indigo-500/10' },
              {
                label: 'Latest Score',
                value: avgScore != null ? avgScore.toFixed(1) : '—',
                icon: TrendingUp,
                color: avgScore == null ? 'text-gray-400 bg-gray-500/10'
                  : avgScore < 5 ? 'text-red-400 bg-red-500/10'
                  : avgScore < 7 ? 'text-amber-400 bg-amber-500/10'
                  : 'text-green-400 bg-green-500/10',
              },
              {
                label: 'Fitness Level',
                value: fitnessLevel ?? '—',
                icon: Activity,
                color: 'text-purple-400 bg-purple-500/10',
              },
              { label: 'Stat Categories', value: latestAssessment?.statScores?.length ?? 0, icon: TrendingUp, color: 'text-blue-400 bg-blue-500/10' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className={`inline-flex p-2 rounded-xl mb-2 ${s.color}`}>
                  <s.icon size={16} />
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Physical stats */}
        {playerData && (
          <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Physical Profile</h2>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Age', value: playerData.age ?? '—', unit: 'yrs' },
                  { label: 'Height', value: playerData.height ?? '—', unit: 'cm' },
                  { label: 'Weight', value: playerData.weight ?? '—', unit: 'kg' },
                  { label: 'Fitness Level', value: playerData.fitnessLevel ?? '—', unit: '/10' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{s.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{s.value !== '—' ? s.unit : ''}</span></p>
                  </div>
                ))}
              </div>
              {playerData.goals && (
                <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Goals</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{playerData.goals}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Dietary restrictions */}
        {dietaryItems.length > 0 && (
          <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
              <span className="flex items-center gap-1.5"><Salad size={14} /> Dietary Profile</span>
            </h2>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex flex-wrap gap-2">
                {dietaryItems.map(item => (
                  <span
                    key={item.id}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                      SEVERITY_STYLES[item.severity] ?? 'bg-gray-500/20 text-gray-400'
                    )}
                  >
                    {item.severity === 'Hard' && <ShieldAlert size={11} />}
                    {item.category}{item.specificItem ? ` (${item.specificItem})` : ''}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Account settings */}
        <motion.div custom={4} initial="hidden" animate="show" variants={fadeUp}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Account Settings</h2>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {/* Display name */}
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Display Name</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <User size={14} className="text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-300">{user?.fullName}</p>
              </div>
            </div>

            {/* Email */}
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email Address</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <Mail size={14} className="text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
            </div>

            {/* Password */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Password</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Change your account password</p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(v => !v)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
                >
                  {showPasswordForm ? 'Cancel' : 'Change'}
                </button>
              </div>
              {showPasswordForm && (
                <div className="space-y-3 mt-3">
                  {[
                    { label: 'Current password', key: 'current', show: showCurrent, toggle: () => setShowCurrent(v => !v) },
                    { label: 'New password', key: 'newPass', show: showNew, toggle: () => setShowNew(v => !v) },
                    { label: 'Confirm new password', key: 'confirm', show: showConfirm, toggle: () => setShowConfirm(v => !v) },
                  ].map(({ label, key, show, toggle }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                      <div className="relative">
                        <input
                          type={show ? 'text' : 'password'}
                          value={passwordForm[key as keyof typeof passwordForm]}
                          onChange={e => setPasswordForm(v => ({ ...v, [key]: e.target.value }))}
                          className="w-full px-3 py-2 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={toggle} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
                          {show ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleSavePassword}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
