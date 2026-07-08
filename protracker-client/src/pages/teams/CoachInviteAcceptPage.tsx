import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Activity, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowLeft, User } from 'lucide-react';
import { teamCoachesApi } from '../../api/teamCoachesApi';
import { Spinner } from '../../components/ui/Spinner';
import type { ValidateCoachInvite } from '../../types';

const inputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';

function passwordStrength(pw: string): { label: string; color: string; ok: boolean } {
  if (pw.length < 8) return { label: 'Weak', color: 'bg-red-500', ok: false };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Strong', color: 'bg-green-500', ok: true };
  return { label: 'Fair', color: 'bg-amber-500', ok: false };
}

function roleLabel(role: string) {
  return role === 'AssistantCoach' ? 'Assistant Coach' : role === 'Analyst' ? 'Analyst' : 'Coach';
}

export function CoachInviteAcceptPage() {
  const { token = '' } = useParams();

  const [validating, setValidating] = useState(true);
  const [info, setInfo] = useState<ValidateCoachInvite | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setValidating(false); return; }
      try {
        const res = await teamCoachesApi.validate(token);
        if (!cancelled) setInfo(res);
      } catch {
        if (!cancelled) setInfo({ valid: false } as ValidateCoachInvite);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const existing = info?.emailHasAccount ?? false;
  const strength = passwordStrength(password);
  const canSubmit = existing
    ? password.length > 0 && !submitting
    : password.length >= 8 && strength.ok && fullName.trim().length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !info) return;
    setError('');
    setSubmitting(true);
    try {
      await teamCoachesApi.accept(
        existing ? { token, password } : { token, password, fullName: fullName.trim() }
      );
      // Tokens are stored by the api call — hard reload so AuthContext picks up the
      // new session and routes to the coach dashboard.
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invite.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur p-8 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
        </div>

        {validating ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !info?.valid ? (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
              <AlertCircle className="text-red-400" size={22} />
            </div>
            <h1 className="text-lg font-bold text-white mb-1">Invite not valid</h1>
            <p className="text-sm text-gray-400 mb-6">This invite link is invalid or has expired. Ask the head coach to send a new one.</p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:underline">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-indigo-900/20 border border-indigo-800/50 p-3.5 mb-5">
              <ShieldCheck size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-white">{info.inviterName}</span> invited you to join{' '}
                <span className="font-semibold text-white">{info.teamName}</span>
                {info.sportName ? ` (${info.sportName})` : ''} as{' '}
                <span className="font-semibold text-white">{roleLabel(info.role)}</span>.
              </p>
            </div>

            <h1 className="text-lg font-bold text-white mb-1">
              {existing ? 'Accept invitation' : 'Create your account'}
            </h1>
            <p className="text-sm text-gray-400 mb-5">
              {existing
                ? `Confirm to add ${info.teamName} to your coaching account.`
                : `Set up your coach account for ${info.email}.`}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!existing && (
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className={inputCls}
                    autoFocus
                  />
                </div>
              )}
              <div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={existing ? 'Your password' : 'Create a password'}
                    className={inputCls}
                    autoFocus={existing}
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {!existing && password.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div className={clsx('h-full transition-all', strength.color)} style={{ width: strength.ok ? '100%' : password.length >= 8 ? '66%' : '33%' }} />
                    </div>
                    <span className="text-[11px] text-gray-400">{strength.label}</span>
                  </div>
                )}
                {!existing && (
                  <p className="text-[11px] text-gray-500 mt-1.5">At least 8 characters, with an uppercase letter and a number.</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2.5">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer"
              >
                {submitting ? 'Setting up…' : 'Accept & continue'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-5">
              Already signed in elsewhere? <Link to="/login" className="text-indigo-400 hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
