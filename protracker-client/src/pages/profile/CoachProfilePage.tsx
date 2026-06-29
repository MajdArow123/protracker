import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, ClipboardList, TrendingUp,
  Mail, Calendar, Edit2, Check, X, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCoachDashboard } from '../../hooks/useDashboard';
import { useToast } from '../../context/ToastContext';
import { PageWrapper } from '../../components/layout/PageWrapper';

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

export function CoachProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { data } = useCoachDashboard();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });

  const memberSince = 'January 2026';

  const stats = [
    { label: 'Total Teams', value: data?.totalTeams ?? 0, icon: Shield, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Total Players', value: data?.totalPlayers ?? 0, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Assessments', value: '—', icon: ClipboardList, color: 'text-indigo-400 bg-indigo-500/10' },
    { label: 'Plans Generated', value: '—', icon: TrendingUp, color: 'text-green-400 bg-green-500/10' },
  ];

  function handleSaveName() {
    if (displayName.trim()) {
      addToast('Display name updated', 'success');
      setEditingName(false);
    }
  }

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
        {/* Profile header card */}
        <motion.div
          custom={0} initial="hidden" animate="show" variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
        >
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border-2 border-indigo-500/30 flex items-center justify-center text-indigo-400 text-2xl font-black flex-shrink-0">
              {user?.fullName ? getInitials(user.fullName) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="text-xl font-bold bg-transparent border-b-2 border-indigo-500 text-gray-900 dark:text-white outline-none pb-0.5 flex-1 min-w-0"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="p-1 text-green-500 hover:text-green-400 cursor-pointer"><Check size={18} /></button>
                  <button onClick={() => { setEditingName(false); setDisplayName(user?.fullName ?? ''); }} className="p-1 text-red-500 hover:text-red-400 cursor-pointer"><X size={18} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{user?.fullName}</h1>
                  <button onClick={() => setEditingName(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"><Edit2 size={14} /></button>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <Mail size={13} />
                {user?.email}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
                  <Shield size={11} /> Head Coach
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar size={12} /> Member since {memberSince}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
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

        {/* My Teams */}
        {data?.teams?.length ? (
          <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">My Teams</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.teams.map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/teams/${t.id}`)}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Shield size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.sportName} · {t.playerCount ?? 0} players</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}

        {/* Account Settings */}
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Account Settings</h2>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {/* Display name */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Display Name</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your name shown to players and in reports</p>
                </div>
                {!editingName && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                )}
              </div>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <button onClick={handleSaveName} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all cursor-pointer">Save</button>
                  <button onClick={() => { setEditingName(false); setDisplayName(user?.fullName ?? ''); }} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">Cancel</button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">{user?.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="p-5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email Address</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Used for sign in</p>
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
                    <div key={key} className="relative">
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
