import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Activity, AlertCircle, Mail, Lock, Eye, EyeOff,
  User, ArrowRight, CheckCircle, Trophy, Dumbbell,
  Zap, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { preloadDashboard } from '../../routes/lazyPages';

type AuthTab = 'signin' | 'register';
type Role = 'Coach' | 'Athlete';

const SPORTS = [
  { name: 'Football', color: 'bg-green-500' },
  { name: 'Basketball', color: 'bg-orange-500' },
  { name: 'Volleyball', color: 'bg-blue-500' },
  { name: 'Tennis', color: 'bg-purple-500' },
  { name: 'Beach Volleyball', color: 'bg-yellow-500' },
];

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
      preloadDashboard(user.role); // warm the dashboard chunk before redirecting
      navigate(user.role === 'Coach' ? '/dashboard' : user.role === 'Parent' ? '/parent-dashboard' : user.role === 'SoloAthlete' ? '/solo-dashboard' : '/player-dashboard');
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
    <div className="min-h-screen flex bg-[#070a12]">
      {/* Left panel — Stadium Lights branding */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[40%] relative flex-col justify-between p-10 overflow-hidden">
        {/* Stadium spotlight glow from top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[50%] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl" />

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-16">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">
              <span className="text-indigo-400">Pro</span><span className="text-white">Tracker</span>
            </span>
          </div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-4">
              Train<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Smarter.
              </span>
            </h1>
            <h2 className="text-3xl xl:text-4xl font-black text-white/90 leading-tight tracking-tight">
              Perform<br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Better.
              </span>
            </h2>
            <p className="text-gray-400 text-sm mt-5 leading-relaxed max-w-xs">
              The all-in-one platform for coaches and athletes to track performance, nutrition, and growth.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-3 mt-8"
          >
            {[
              { icon: Zap, label: 'Smart Training Plans', color: 'text-yellow-400' },
              { icon: BarChart2, label: 'Real-time Analytics', color: 'text-cyan-400' },
              { icon: Trophy, label: 'Peak Performance Tracking', color: 'text-amber-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className={color} />
                </div>
                <span className="text-sm text-gray-300 font-medium">{label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Sports list at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10"
        >
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Supported Sports</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
                <div className={clsx('w-1.5 h-1.5 rounded-full', s.color)} />
                <span className="text-xs text-gray-400 font-medium">{s.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600/6 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Mobile-only logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">
              <span className="text-indigo-400">Pro</span><span className="text-white">Tracker</span>
            </span>
          </div>

          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 p-7">
            <div className="mb-6">
              <h3 className="text-lg font-black text-white">
                {tab === 'signin' ? 'Welcome back' : 'Create your account'}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {tab === 'signin' ? 'Sign in to your ProTracker account' : 'Start your performance journey'}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5">
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
                  {t === 'signin' ? 'Sign In' : 'Register'}
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

                  <div className="flex justify-end -mt-1">
                    <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-gray-400 hover:text-indigo-400 hover:underline transition-colors cursor-pointer">
                      Forgot your password?
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

                  <button type="button" onClick={() => setTab('register')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer mt-1">
                    No account? <span className="text-indigo-400 font-semibold">Sign up free</span>
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
                  className="space-y-3"
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

                  {/* Role selector */}
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
                            'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer',
                            regRole === role
                              ? 'border-indigo-500 bg-indigo-600/20 text-white'
                              : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                          )}
                        >
                          <Icon size={20} className={regRole === role ? 'text-indigo-400' : 'text-gray-500'} />
                          <span className="text-xs font-semibold">{role}</span>
                          <span className="text-[10px] text-gray-500 text-center leading-tight">{desc}</span>
                          {regRole === role && <CheckCircle size={11} className="text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {regError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
                      <AlertCircle size={14} className="flex-shrink-0" /> {regError}
                    </div>
                  )}

                  <button type="submit" disabled={isRegistering} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer mt-1">
                    {isRegistering ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight size={15} /></>}
                  </button>

                  <button type="button" onClick={() => navigate('/register')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer mt-1">
                    Athlete with a team join code? <span className="text-indigo-400 font-semibold">Join your team</span>
                  </button>

                  <button type="button" onClick={() => navigate('/register/solo')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                    Train Solo — no coach required? <span className="text-indigo-400 font-semibold">Start solo</span>
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-gray-700 mt-5 flex items-center justify-center gap-3">
            <span>5 Sports</span>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <span>30+ Players</span>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <span>AI Analytics</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
