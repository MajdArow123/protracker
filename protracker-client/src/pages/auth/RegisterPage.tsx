import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, ArrowRight, Ticket, User } from 'lucide-react';
import { joinApi } from '../../api/joinApi';

// Landing spot for athletes who were given a join code (rather than a direct /join/{code}
// link or QR). A valid code drops them into the full /join/{code} registration flow.
export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4 || checking) return;
    setError('');
    setChecking(true);
    try {
      const info = await joinApi.validateCode(normalized);
      if (info.valid) {
        navigate(`/join/${normalized}`);
      } else {
        setError(
          info.reason === 'expired' ? t('register.codeExpired', 'That code has expired. Ask your coach for a new one.')
          : info.reason === 'maxed' ? t('register.codeMaxed', 'That code has reached its maximum uses. Ask your coach for a new one.')
          : info.reason === 'inactive' ? t('register.codeInactive', 'That code has been deactivated. Ask your coach for a new one.')
          : t('register.codeNotFound', "We couldn't find that code. Double-check it and try again."),
        );
        setChecking(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.codeCheckFailed', 'Could not check the code. Try again.'));
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur p-8 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mb-4">
          <Ticket size={22} className="text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1.5">{t('register.joinYourTeam', 'Join your team')}</h1>
        <p className="text-sm text-gray-400 mb-6">
          {t('register.joinCodeIntro', "Enter the join code your coach shared with you — it's on the team's QR poster or invite link.")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder={t('register.codePlaceholder', 'e.g. CITY2026')}
            maxLength={12}
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl bg-gray-800/60 border border-gray-700 px-4 py-4 text-center text-xl font-black tracking-[0.3em] text-white placeholder:text-gray-600 placeholder:tracking-[0.15em] placeholder:text-base placeholder:font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all uppercase"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-2.5">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={code.trim().length < 4 || checking}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {checking ? t('register.checking', 'Checking…') : <>{t('register.continue', 'Continue')} <ArrowRight size={15} /></>}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-gray-800/40 border border-gray-800 p-3.5">
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-gray-300">{t('register.noCodeQ', "Don't have a code?")}</span> {t('register.noCodeHelp', "Ask your coach to share the team's join link or QR code from their team page.")}
          </p>
        </div>

        {/* No team? Solo mode */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{t('common.or', 'or')}</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <Link
          to="/register/solo"
          className="mt-4 flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-800/30 hover:border-indigo-500/50 hover:bg-indigo-600/10 p-4 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{t('auth.trainSolo', 'Train Solo')}</p>
            <p className="text-xs text-gray-400">{t('register.soloDesc', 'No coach? Track your own performance and improve at your own pace.')}</p>
          </div>
          <ArrowRight size={16} className="text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
        </Link>

        <p className="text-center text-xs text-gray-500 mt-6">
          {t('auth.hasAccount', 'Already have an account?')} <Link to="/login" className="text-indigo-400 hover:underline">{t('auth.signIn', 'Sign in')}</Link>
        </p>
      </motion.div>
    </div>
  );
}
