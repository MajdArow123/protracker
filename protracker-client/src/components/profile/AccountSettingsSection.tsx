import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useChangePassword } from '../../hooks/useProfile';
import { profileApi } from '../../api/profileApi';

function passwordStrength(pw: string): { label: string; color: string; ok: boolean } {
  if (pw.length < 8) return { label: 'Weak', color: 'bg-red-500', ok: false };
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) return { label: 'Strong', color: 'bg-green-500', ok: true };
  return { label: 'Fair', color: 'bg-amber-500', ok: false };
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all';

export function AccountSettingsSection({ isCoach }: { isCoach: boolean }) {
  const { addToast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const changePassword = useChangePassword();

  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const strength = passwordStrength(next);
  const canSubmitPw = current.length > 0 && strength.ok && next === confirm && !changePassword.isPending;

  const submitPassword = async () => {
    if (!canSubmitPw) return;
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      addToast('Password updated successfully', 'success');
      setPwOpen(false);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not update password', 'error');
    }
  };

  const submitDelete = async () => {
    if (deleteText !== 'DELETE' || !deletePassword || deleting) return;
    setDeleting(true);
    try {
      await profileApi.deleteAccount(deletePassword);
      addToast('Your account has been deleted', 'success');
      await logout();
      navigate('/');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not delete account', 'error');
      setDeleting(false);
    }
  };

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Account Settings</h2>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
        {/* Change password */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <KeyRound size={14} className="text-indigo-400" /> Password
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Change your account password</p>
          </div>
          <button
            onClick={() => setPwOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer flex-shrink-0"
          >
            Change Password
          </button>
        </div>

        {/* Danger zone */}
        <div className="p-5 bg-red-50/50 dark:bg-red-950/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} /> Delete Account
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isCoach
                  ? 'Permanently delete your account. Teams must be deleted first.'
                  : 'Permanently delete your account. Your training history stays with your coach.'}
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-500 transition-colors cursor-pointer flex-shrink-0"
            >
              Delete…
            </button>
          </div>
        </div>
      </div>

      {/* Change password modal */}
      <Modal isOpen={pwOpen} onClose={() => setPwOpen(false)} title="Change Password" size="sm">
        <div className="space-y-3">
          {[
            { label: 'Current password', value: current, set: setCurrent },
            { label: 'New password', value: next, set: setNext },
            { label: 'Confirm new password', value: confirm, set: setConfirm },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder="••••••••"
                  className={clsx(inputCls, 'pr-10')}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          {next.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className={clsx('h-full transition-all', strength.color)} style={{ width: strength.ok ? '100%' : next.length >= 8 ? '66%' : '33%' }} />
              </div>
              <span className="text-[11px] text-gray-400">{strength.label}</span>
            </div>
          )}
          {confirm.length > 0 && next !== confirm && (
            <p className="text-[11px] text-red-400">Passwords don't match.</p>
          )}
          <p className="text-[11px] text-gray-400">At least 8 characters, with an uppercase letter and a number.</p>
          <button
            onClick={submitPassword}
            disabled={!canSubmitPw}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {changePassword.isPending ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : 'Update Password'}
          </button>
        </div>
      </Modal>

      {/* Delete account modal */}
      <Modal isOpen={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteText(''); setDeletePassword(''); }} title="Delete Account" size="sm">
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-500">
              This permanently deletes your ProTracker account and signs you out everywhere. This cannot be undone.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Type <span className="font-black text-red-500">DELETE</span> to confirm
            </label>
            <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="DELETE" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Your password</label>
            <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="••••••••" className={inputCls} />
          </div>
          <button
            onClick={submitDelete}
            disabled={deleteText !== 'DELETE' || !deletePassword || deleting}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Permanently Delete My Account'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
