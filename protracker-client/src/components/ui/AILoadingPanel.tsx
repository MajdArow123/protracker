import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface Props {
  primaryText: string;
  messages: string[];
  note?: string;
  /** Estimated total time in seconds — progress bar fills to 90% over this */
  estimatedSeconds?: number;
  /** How long (ms) each message shows before cycling */
  messageInterval?: number;
  /** Compact inline variant for guidance/insights/improvement */
  compact?: boolean;
}

export function AILoadingPanel({
  primaryText,
  messages,
  note,
  estimatedSeconds = 45,
  messageInterval = 4500,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [slow, setSlow] = useState(false);

  // Cycle messages
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), messageInterval);
    return () => clearInterval(t);
  }, [messages.length, messageInterval]);

  // Smooth progress: reaches ~90% at estimatedSeconds, then stalls
  useEffect(() => {
    const step = 90 / (estimatedSeconds * 10);
    const t = setInterval(() => setProgress(p => Math.min(p + step, 90)), 100);
    return () => clearInterval(t);
  }, [estimatedSeconds]);

  // "Taking longer than usual" after 90 s
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 90_000);
    return () => clearTimeout(t);
  }, []);

  const currentMsg = slow ? t('ui.takingLonger', 'This is taking longer than usual, hang tight…') : messages[msgIdx];

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
        <Sparkles size={14} className="text-violet-500 animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">{primaryText}</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={slow ? '__slow__' : msgIdx}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-violet-500 dark:text-violet-400 mt-0.5 truncate"
            >
              {currentMsg}
            </motion.p>
          </AnimatePresence>
        </div>
        {/* Mini progress bar */}
        <div className="w-14 flex-shrink-0">
          <div className="h-1 bg-violet-200 dark:bg-violet-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 max-w-sm mx-auto text-center gap-6">
      {/* Pulsing orb */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-full bg-violet-400/20 dark:bg-violet-500/15 animate-ping" />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
          <Sparkles size={28} className="text-white animate-pulse" />
        </div>
      </div>

      {/* Text */}
      <div className="space-y-2">
        <p className="text-lg font-bold text-gray-900 dark:text-white">{primaryText}</p>
        <div className="h-5">
          <AnimatePresence mode="wait">
            <motion.p
              key={slow ? '__slow__' : msgIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-violet-600 dark:text-violet-400"
            >
              {currentMsg}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-violet-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Note */}
      {note && !slow && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{note}</p>
      )}
    </div>
  );
}
