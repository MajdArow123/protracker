import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

// Subtle top banner shown while the browser reports no network connection.
// Disappears automatically when the connection returns.
export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 py-2 px-4 bg-amber-500 text-amber-950 text-sm font-semibold shadow-lg"
          role="status"
        >
          <WifiOff size={15} />
          {t('ui.offline', "You're offline. Some features may not work.")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
