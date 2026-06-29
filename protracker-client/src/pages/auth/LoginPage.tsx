import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, AlertCircle, Mail, Lock, Eye, EyeOff,
  User, ArrowRight, CheckCircle, Trophy, Dumbbell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type AuthTab = 'signin' | 'register';
type Role = 'Coach' | 'Athlete';

// Geometric shapes instead of emojis — more professional
const FLOATING_SHAPES = [
  { shape: 'circle', size: 64, x: '8%', y: '15%', dur: 6, delay: 0, opacity: 0.06 },
  { shape: 'hexagon', size: 48, x: '88%', y: '10%', dur: 7, delay: 1.2, opacity: 0.07 },
  { shape: 'circle', size: 80, x: '5%', y: '72%', dur: 8, delay: 0.5, opacity: 0.05 },
  { shape: 'circle', size: 40, x: '92%', y: '65%', dur: 6.5, delay: 2, opacity: 0.08 },
  { shape: 'hexagon', size: 56, x: '50%', y: '5%', dur: 9, delay: 0.8, opacity: 0.06 },
  { shape: 'circle', size: 32, x: '75%', y: '85%', dur: 7.5, delay: 1.5, opacity: 0.07 },
  { shape: 'hexagon', size: 72, x: '20%', y: '55%', dur: 8.5, delay: 3, opacity: 0.04 },
];

function FloatingShape({ shape, size, x, y, dur, delay, opacity }: typeof FLOATING_SHAPES[0]) {
  return (
    <motion.div
      className="fixed select-none pointer-events-none"
      style={{ left: x, top: y }}
      animate={{ y: [0, -16, 0], rotate: shape === 'hexagon' ? [0, 30, 0] : [0, 8, -8, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity }}
    >
      {shape === 'circle' ? (
        <div
          style={{ width: size, height: size }}
          className="rounded-full bg-indigo-400 dark:bg-indigo-500"
        />
      ) : (
        <svg width={size} height={size} viewBox="0 0 100 100" fill="rgba(99,102,241,0.9)">
          <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
        </svg>
      )}
    </motion.div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i < strength ? colors[strength - 1] : 'bg-gray-700'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-500">{labels[strength - 1] ?? ''}</p>
    </div>
  );
}

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<Role>('Coach');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter email and password'); return; }
    setError('');
    setIsLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'Coach' ? '/dashboard' : '/player-dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) { setRegError('Display name is required'); return; }
    if (!regEmail.trim()) { setRegError('Email is required'); return; }
    if (regPassword.length < 8) { setRegError('Password must be at least 8 characters'); return; }
    if (regPassword !== regConfirm) { setRegError('Passwords do not match'); return; }
    setRegError('');
    setIsRegistering(true);
    try {
      await register(regName, regEmail, regPassword, regRole);
      navigate(regRole === 'Coach' ? '/dashboard' : '/player-dashboard');
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#080b14]">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-[#080b14] to-purple-950/40" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />

      {/* Floating geometric shapes (no emojis) */}
      {FLOATING_SHAPES.map((s, i) => <FloatingShape key={i} {...s} />)}

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(99,102,241,0.4)', '0 0 0 8px rgba(99,102,241,0)', '0 0 0 0 rgba(99,102,241,0)'] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center"
            >
              <Activity size={21} className="text-white" />
            </motion.div>
            <span className="text-xl font-black tracking-tight">
              <span className="text-indigo-400">Pro</span><span className="text-white">Tracker</span>
            </span>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6">
            {(['signin', 'register'] as AuthTab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setRegError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  tab === t
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'signin' ? (
              <motion.form
                key="signin"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSignIn}
                className="space-y-4"
              >
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required className={inputCls} />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required className={clsx(inputCls, 'pr-10')} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" /> {error}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer mt-2">
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight size={15} /></>}
                </button>

                <button type="button" onClick={() => setTab('register')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer mt-2">
                  Don't have an account? <span className="text-indigo-400 font-semibold">Sign up free</span>
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Display name" autoComplete="name" required className={inputCls} />
                </div>

                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email address" autoComplete="email" required className={inputCls} />
                </div>

                <div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type={showRegPassword ? 'text' : 'password'} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Password" autoComplete="new-password" required className={clsx(inputCls, 'pr-10')} />
                    <button type="button" onClick={() => setShowRegPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordStrength password={regPassword} />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" required className={clsx(inputCls, regConfirm && (regConfirm === regPassword ? 'border-green-500/50' : 'border-red-500/50'))} />
                  {regConfirm && regConfirm === regPassword && <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />}
                </div>

                {/* Role selector — Lucide icons instead of emojis */}
                <div>
                  <p className="text-xs text-gray-400 mb-2 font-medium">I am a…</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { role: 'Coach' as Role, icon: Trophy, desc: 'I manage athletes & teams' },
                      { role: 'Athlete' as Role, icon: Dumbbell, desc: 'I track my performance' },
                    ]).map(({ role, icon: Icon, desc }) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setRegRole(role)}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all cursor-pointer',
                          regRole === role
                            ? 'border-indigo-500 bg-indigo-600/20 text-white'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                        )}
                      >
                        <Icon size={22} className={regRole === role ? 'text-indigo-400' : 'text-gray-500'} />
                        <span className="text-xs font-semibold">{role}</span>
                        <span className="text-[10px] text-gray-500 text-center leading-tight">{desc}</span>
                        {regRole === role && <CheckCircle size={12} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                {regError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0" /> {regError}
                  </div>
                )}

                <button type="submit" disabled={isRegistering} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer mt-2">
                  {isRegistering ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight size={15} /></>}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6 flex items-center justify-center gap-3">
          <span>5 Sports</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>30+ Players</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>Real-time Analytics</span>
        </p>
      </motion.div>
    </div>
  );
}
