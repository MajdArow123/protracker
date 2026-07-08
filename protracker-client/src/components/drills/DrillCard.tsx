import { Heart, Clock, Dumbbell, Plus, ArrowRight, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { useToggleDrillFavorite } from '../../hooks/useDrills';
import { CATEGORY_BADGE, CATEGORY_LABEL, DIFFICULTY_BADGE, sportBadge, SPORT_SHORT } from './drillUtils';
import type { Drill } from '../../types';

interface Props {
  drill: Drill;
  canAssign?: boolean;
  onOpen: (drill: Drill) => void;
  onAssign?: (drill: Drill) => void;
  recommended?: boolean;
}

export function DrillCard({ drill, canAssign, onOpen, onAssign, recommended }: Props) {
  const toggleFav = useToggleDrillFavorite();

  return (
    <div
      onClick={() => onOpen(drill)}
      className={clsx(
        'group relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md',
        recommended ? 'border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-200 dark:border-gray-700',
      )}
    >
      {recommended && (
        <span className="absolute -top-2 left-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow">
          <Sparkles size={10} /> Recommended
        </span>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {drill.sportIds.map(id => (
          <span key={id} className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', sportBadge(id))}>
            {SPORT_SHORT[id] ?? drill.sportNames[0] ?? 'Sport'}
          </span>
        ))}
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', DIFFICULTY_BADGE[drill.difficulty])}>
          {drill.difficulty}
        </span>
        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORY_BADGE[drill.category])}>
          {CATEGORY_LABEL[drill.category]}
        </span>
      </div>

      {/* Title + fav */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{drill.name}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFav.mutate(drill.id); }}
          className="flex-shrink-0 p-1 -m-1 cursor-pointer"
          title={drill.isFavorited ? 'Remove favorite' : 'Add to favorites'}
        >
          <Heart size={17} className={clsx('transition-colors', drill.isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-red-400')} />
        </button>
      </div>

      {drill.description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{drill.description}</p>
      )}

      {/* Meta pills */}
      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {drill.durationMinutes != null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <Clock size={11} /> {drill.durationMinutes} min
          </span>
        )}
        {drill.equipment && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <Dumbbell size={11} /> {drill.equipment}
          </span>
        )}
      </div>

      {/* Target tags */}
      {drill.targetStatCategories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {drill.targetStatCategories.slice(0, 3).map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{t}</span>
          ))}
        </div>
      )}

      {recommended && drill.recommendReason && (
        <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 line-clamp-2">
          <span className="font-semibold">Why: </span>{drill.recommendReason}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
        {canAssign ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAssign?.(drill); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          >
            <Plus size={14} /> Assign
          </button>
        ) : <span />}
        <span className="flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-indigo-500 transition-colors">
          View <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </div>
  );
}
