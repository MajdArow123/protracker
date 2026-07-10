import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Trophy, ArrowRight } from 'lucide-react';
import { useMyLeagues } from '../../hooks/useLeagues';
import { sportBadge } from '../../utils/sportColors';
import { LEAGUE_STATUS_STYLES } from '../../utils/leagueMeta';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

// Athlete/solo dashboard widget — leagues their team is registered in. Renders nothing
// when there are none.
export function MyLeaguesCard({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { data: leagues = [] } = useMyLeagues(enabled);
  if (leagues.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">{t('leagues.myLeagues', 'My Leagues')}</h2>
        </div>
        <Link to="/leagues" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{t('common.viewAll', 'View All')}</Link>
      </div>
      <div className="space-y-2">
        {leagues.slice(0, 3).map(l => (
          <Link key={l.id} to={`/leagues/${l.id}`}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-all">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
              <Trophy size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{l.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {l.sportName && <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-semibold', sportBadge(l.sportName))}>{L.sport(l.sportName)}</span>}
                <span className="text-[10px] text-gray-400">{l.teamCount} {t('leagues.teamsLabel', 'teams')}</span>
              </div>
            </div>
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0', LEAGUE_STATUS_STYLES[l.status])}>{L.status(l.status)}</span>
            <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
