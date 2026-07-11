import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

// Gradient insight cards for AI-generated analysis (player + team reports):
// numbered gradient chip, soft violet→indigo wash, staggered entrance.
export function AIInsightsList({ insights }: { insights: string[] }) {
  return (
    <ul className="space-y-3">
      {insights.map((insight, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.08, ease: 'easeOut' }}
          className="relative overflow-hidden flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent border border-violet-200/70 dark:border-violet-800/40"
        >
          <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex-shrink-0 shadow-md shadow-violet-500/20">
            <Lightbulb size={13} />
          </div>
          <span className="text-sm text-gray-800 dark:text-gray-200 relative pt-1">{insight}</span>
        </motion.li>
      ))}
    </ul>
  );
}
