import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { MapPin, Users, Shield, ArrowRight } from 'lucide-react';
import { sportBadge } from '../../utils/sportColors';
import type { CoachMarketplaceItem } from '../../types';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function CoachCard({ coach }: { coach: CoachMarketplaceItem }) {
  const location = [coach.city, coach.country].filter(Boolean).join(', ');

  return (
    <Link
      to={`/coaches/${coach.slug}`}
      className="group flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700"
    >
      <div className="flex items-start gap-3">
        {coach.profilePictureUrl ? (
          <img src={coach.profilePictureUrl} alt={coach.displayName} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
            {initials(coach.displayName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-gray-900 dark:text-white truncate">{coach.displayName}</h3>
            {coach.isAcceptingAthletes && (
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Accepting athletes" />
            )}
          </div>
          {coach.sportName && (
            <span className={clsx('inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', sportBadge(coach.sportName))}>
              {coach.sportName}
            </span>
          )}
        </div>
      </div>

      {location && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-3">
          <MapPin size={12} /> {location}
          {coach.yearsCoaching != null && <span className="ml-1">· {coach.yearsCoaching} yrs</span>}
        </div>
      )}
      {!location && coach.yearsCoaching != null && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">{coach.yearsCoaching} yrs coaching</div>
      )}

      {coach.specialization && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-1">{coach.specialization}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1"><Shield size={12} /> {coach.teamCount} teams</span>
        <span className="flex items-center gap-1"><Users size={12} /> {coach.playerCount} athletes</span>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-1.5 transition-all">
          View Profile <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}
