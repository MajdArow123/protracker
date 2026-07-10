import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isPushSupported, currentPermission, enablePush } from '../push/pushManager';

// One-time, dismissible prompt to enable browser notifications after signing in. If permission
// was already granted, it silently refreshes the push subscription instead of prompting.
export function PushPrompt() {
  const { t: tr } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const promptedKey = user ? `pt_push_prompted_${user.id}` : '';

  useEffect(() => {
    if (!user || !isPushSupported()) return;
    const perm = currentPermission();
    if (perm === 'granted') {
      // Keep the server's subscription fresh across logins/devices.
      enablePush();
      return;
    }
    if (perm === 'default' && !localStorage.getItem(promptedKey)) {
      const t = setTimeout(() => setShow(true), 1500); // let the dashboard settle first
      return () => clearTimeout(t);
    }
  }, [user, promptedKey]);

  function dismiss() {
    if (promptedKey) localStorage.setItem(promptedKey, '1');
    setShow(false);
  }

  async function enable() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    if (promptedKey) localStorage.setItem(promptedKey, '1');
    setShow(false);
    if (result === 'subscribed') addToast(tr('ui.pushEnabled', 'Notifications enabled'), 'success');
    else if (result === 'denied') addToast(tr('ui.pushBlocked', 'Notifications blocked in your browser settings'), 'info');
    else if (result === 'error') addToast(tr('ui.pushError', 'Could not enable notifications'), 'error');
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4"
        >
          <button onClick={dismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" aria-label={tr('common.dismiss', 'Dismiss')}>
            <X size={16} />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <Bell size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{tr('ui.turnOnNotifications', 'Turn on notifications')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {tr('ui.pushPromptDesc', 'Get alerts for new messages, tasks and announcements — even when ProTracker is closed.')}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={dismiss} className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">{tr('ui.notNow', 'Not now')}</button>
            <button onClick={enable} disabled={busy} className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer">
              {busy ? tr('ui.enabling', 'Enabling…') : tr('ui.enable', 'Enable')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
