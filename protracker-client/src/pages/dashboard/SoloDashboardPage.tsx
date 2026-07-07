import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Interim solo home: greets the athlete right after registration. The full solo
// dashboard (stats, quick actions, progress) replaces this in the next phase.
export function SoloDashboardPage() {
  const { user, logout } = useAuth();
  const [welcome, setWelcome] = useState<{ name: string; sport: string } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('pt_welcome_solo');
    if (raw) {
      try { setWelcome(JSON.parse(raw)); } catch { /* ignore */ }
      sessionStorage.removeItem('pt_welcome_solo');
    }
  }, []);

  const name = welcome?.name ?? user?.fullName ?? 'Athlete';

  return (
    <div className="min-h-screen bg-[#0b0d12] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900/70 backdrop-blur p-8 text-center"
      >
        <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-5">
          <Activity size={22} className="text-white" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-4">
          <Sparkles size={12} /> Solo mode
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight mb-2">
          Welcome to ProTracker, {name.split(' ')[0]}!
        </h1>
        <p className="text-sm text-gray-400">
          {welcome?.sport
            ? <>You're all set to start tracking your <span className="text-white font-semibold">{welcome.sport}</span> performance.</>
            : 'You\'re all set to start tracking your performance.'}
        </p>
        <p className="text-xs text-gray-500 mt-4">
          Your solo dashboard — assessments, AI nutrition plans, training and more — is on its way in the next update.
        </p>
        <button
          onClick={() => void logout()}
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut size={14} /> Sign out
        </button>
      </motion.div>
    </div>
  );
}
