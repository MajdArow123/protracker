import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Activity, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '../../api/authApi';

const inputCls = 'w-full rounded-xl bg-gray-800/60 border border-gray-700 pl-10 pr-3 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.enterEmail', 'Please enter your email address.')); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError', 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-7 sm:p-8"
      >
        <div className="flex items-center gap-2.5 mb-7">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={19} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
        </div>

        {sent ? (
          <div>
            <div className="inline-flex p-3 rounded-2xl bg-green-500/10 mb-4">
              <CheckCircle size={30} className="text-green-500" />
            </div>
            <h1 className="text-xl font-black text-white">{t('auth.checkEmail', 'Check your email!')}</h1>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {t('auth.resetLinkSentPre', 'We sent a reset link to')} <span className="font-semibold text-gray-200">{email.trim()}</span>{t('auth.resetLinkSentPost', '. It expires in 1 hour.')}
            </p>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              {t('auth.resetNotReceived', "Didn't receive it? Check your spam folder, or try again in a few minutes.")}
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              <ArrowLeft size={15} /> {t('auth.backToLogin', 'Back to Login')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-black text-white">{t('auth.forgotPassword', 'Forgot your password?')}</h1>
            <p className="mt-1.5 text-sm text-gray-400">{t('auth.forgotPasswordSubtitle', "Enter your email and we'll send you a reset link.")}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailAddress', 'Email address')}
                  autoComplete="email"
                  required
                  className={inputCls}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400 text-sm">
                  <AlertCircle size={14} className="flex-shrink-0" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/30 cursor-pointer',
                  loading && 'opacity-60 cursor-not-allowed',
                )}
              >
                {loading ? t('auth.sending', 'Sending…') : t('auth.sendResetLink', 'Send Reset Link')}
              </button>
            </form>

            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-400 transition-colors">
              <ArrowLeft size={15} /> {t('auth.backToLogin', 'Back to Login')}
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
