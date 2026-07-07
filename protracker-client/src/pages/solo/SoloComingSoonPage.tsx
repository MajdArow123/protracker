import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Dumbbell, Heart, Salad, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';

// Interim landing for solo sections that ship in the next updates. Each route is
// replaced by its real page as the solo build-out progresses — keep the copy honest.
const SECTIONS: Record<string, { title: string; desc: string; icon: LucideIcon }> = {
  '/solo/nutrition': { title: 'Nutrition', desc: 'Generate AI meal plans and manage your dietary profile.', icon: Salad },
  '/solo/training': { title: 'Training', desc: 'Schedule and track your personal training sessions.', icon: Dumbbell },
  '/solo/matches': { title: 'Matches', desc: 'Log match results and rate your own performance.', icon: Trophy },
  '/solo/recovery': { title: 'Recovery', desc: 'Track injuries and follow guided recovery programs.', icon: Heart },
};

export function SoloComingSoonPage() {
  const { pathname } = useLocation();
  const section = SECTIONS[pathname] ?? { title: 'Coming soon', desc: 'This part of solo mode is on its way.', icon: TrendingUp };
  const Icon = section.icon;

  return (
    <PageWrapper>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto mt-16 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
          <Icon size={22} className="text-indigo-500" />
        </div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">{section.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{section.desc}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">This section is coming in the next update — it's being rolled out piece by piece.</p>
        <Link
          to="/solo-dashboard"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo-400"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
      </motion.div>
    </PageWrapper>
  );
}
