import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Activity, Lock, Eye, EyeOff, AlertCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { Spinner } from '../../components/ui/Spinner';

const inputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';

// Weak (<8) / Fair (8+) / Strong (8+ & uppercase & number).
function passwordStrength(pw: string): { level: 0 | 1 | 2; label: string; color: string; ok: boolean } {
  if (pw.length < 8) return { level: 0, label: 'Weak', color: 'bg-red-500', ok: false };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { level: 2, label: 'Strong', color: 'bg-green-500', ok: true };
  return { level: 1, label: 'Fair', color: 'bg-amber-500', ok: false };
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState<string | undefined>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setValidating(false); setTokenValid(false); return; }
      try {
        const res = await authApi.validateResetToken(token);
        if (!cancelled) { setTokenValid(res.valid); setEmail(res.email); }
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const strength = passwordStrength(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = strength.ok && matches && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-7 sm:p-8"
      >
        <div className="flex items-center gap-2.5 mb-7">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={19} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
        </div>
        {children}
      </motion.div>
    </div>
  );

  if (validating) {
    return <Shell><div className="py-10 flex flex-col items-center gap-3"><Spinner size="lg" /><p className="text-sm text-gray-400">Verifying reset link…</p></div></Shell>;
  }

  if (!tokenValid) {
    return (
      <Shell>
        <div className="inline-flex p-3 rounded-2xl bg-red-500/10 mb-4"><XCircle size={30} className="text-red-500" /></div>
        <h1 className="text-xl font-black text-white">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">This password reset link has expired or has already been used.</p>
        <button onClick={() => navigate('/forgot-password')} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all cursor-pointer">
          Request a new reset link
        </button>
        <Link to="/login" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-400 transition-colors"><ArrowLeft size={15} /> Back to Login</Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="inline-flex p-3 rounded-2xl bg-green-500/10 mb-4"><CheckCircle size={30} className="text-green-500" /></div>
        <h1 className="text-xl font-black text-white">Password reset successfully!</h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">You can now log in with your new password.</p>
        <button onClick={() => navigate('/login')} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all cursor-pointer">
          Go to Login
        </button>
      </Shell>
    );
  }

  // Valid token → the reset form.
  return (
    <Shell>
      <h1 className="text-xl font-black text-white">Set new password</h1>
      {email && <p className="mt-1.5 text-sm text-gray-400">for <span className="font-semibold text-gray-200">{email}</span></p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" required className={inputCls} />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className={clsx('flex-1 h-1 rounded-full transition-all duration-300', i <= strength.level ? strength.color : 'bg-gray-700')} />
                ))}
              </div>
              <p className="text-xs text-gray-500">{strength.label}{!strength.ok && ' — use 8+ characters with an uppercase letter and a number'}</p>
            </div>
          )}
        </div>

        <div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" required className={clsx(inputCls, confirm && (matches ? 'border-green-500/50' : 'border-red-500/50'))} />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">{showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {confirm && !matches && <p className="mt-1.5 text-xs text-red-400">Passwords don't match.</p>}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
            <AlertCircle size={14} className="flex-shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={!canSubmit} className={clsx('w-full py-3 rounded-xl text-white font-bold text-sm transition-all', canSubmit ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed')}>
          {submitting ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </Shell>
  );
}
