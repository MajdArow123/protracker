import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Trophy, Swords, Medal, Users, MapPin, Crown, CheckCircle2 } from 'lucide-react';
import { sportBadge } from '../../utils/sportColors';
import { LEAGUE_STATUS_STYLES, formatLabel } from '../../utils/leagueMeta';
import type { LeagueSummary, LeagueType } from '../../types';

const TYPE_ICONS: Record<LeagueType, typeof Trophy> = { League: Trophy, Tournament: Swords, Cup: Medal };

export function LeagueCard({ league }: { league: LeagueSummary }) {
  const Icon = TYPE_ICONS[league.type];
  return (
    <Link to={`/leagues/${league.id}`}
      className="group flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white truncate">{league.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {league.sportName && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-semibold', sportBadge(league.sportName))}>{league.sportName}</span>}
              <span className="text-[10px] text-gray-400">{formatLabel(league.format)}</span>
            </div>
          </div>
        </div>
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0', LEAGUE_STATUS_STYLES[league.status])}>{league.status}</span>
      </div>

      {league.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">{league.description}</p>}

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1"><Users size={12} /> {league.teamCount}{league.maxTeams ? `/${league.maxTeams}` : ''} teams</span>
        {league.location && <span className="flex items-center gap-1"><MapPin size={12} /> {league.location}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {league.isOrganizer && <span className="flex items-center gap-0.5 text-amber-500 font-semibold"><Crown size={12} /> Organizer</span>}
          {!league.isOrganizer && league.isRegistered && <span className="flex items-center gap-0.5 text-green-500 font-semibold"><CheckCircle2 size={12} /> Registered</span>}
        </span>
      </div>
    </Link>
  );
}
