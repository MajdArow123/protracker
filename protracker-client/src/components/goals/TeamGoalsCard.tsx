import { useNavigate } from 'react-router-dom';
import { Target, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useCoachGoalOverview } from '../../hooks/useGoals';
import { progressColor } from './goalUtils';

export function TeamGoalsCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useCoachGoalOverview();

  const rows = data?.players ?? [];

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
            <Target size={16} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Player Goals</h2>
            {data && data.totalActiveGoals > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{data.totalActiveGoals} active across {data.playersWithGoals} {data.playersWithGoals === 1 ? 'player' : 'players'}</p>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/goals')} className="flex items-center gap-0.5 text-sm font-medium text-indigo-500 hover:underline cursor-pointer">
          View All <ChevronRight size={15} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No players have set goals yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 6).map(r => (
            <button
              key={r.playerId}
              onClick={() => navigate('/goals')}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 hover:border-gray-200 dark:hover:border-gray-700 transition-colors cursor-pointer text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.playerName}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {r.activeGoals} active{r.achievedGoals > 0 ? ` · ${r.achievedGoals} done` : ''}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className={clsx('h-full rounded-full', progressColor(r.avgProgress ?? 0))} style={{ width: `${r.avgProgress ?? 0}%` }} />
                </div>
              </div>
              {r.avgProgress != null && <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0 w-10 text-right">{r.avgProgress}%</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
