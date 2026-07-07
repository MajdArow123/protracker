import { useMemo } from 'react';
import { CalendarDays, Dumbbell, History } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TeamScheduleSection } from '../../components/sessions/TeamScheduleSection';
import { useSoloSessions } from '../../hooks/useSolo';

// Personal training planner for solo athletes: the same Monday-based week calendar
// the team Schedule tab uses, but every session belongs to (and is managed by) you.
export function SoloTrainingPage() {
  const { data: sessions = [] } = useSoloSessions();

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return {
      total: sessions.length,
      thisWeek: sessions.filter(s => {
        const d = new Date(s.startTime);
        return d >= weekStart && d < weekEnd;
      }).length,
      upcoming: sessions.filter(s => new Date(s.startTime) >= now).length,
      past: sessions.filter(s => new Date(s.startTime) < now).length,
    };
  }, [sessions]);

  return (
    <PageWrapper title="My Training">
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={13} className="text-indigo-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">This Week</p>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.thisWeek}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell size={13} className="text-purple-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Upcoming</p>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.upcoming}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-1">
            <History size={13} className="text-emerald-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Completed</p>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white">{stats.past}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <TeamScheduleSection solo isCoach={false} />
      </div>
    </PageWrapper>
  );
}
