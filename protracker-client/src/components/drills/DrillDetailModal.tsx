import { Heart, Clock, Dumbbell, Play, Plus, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToggleDrillFavorite, useDeleteDrill, useDrill } from '../../hooks/useDrills';
import { useToast } from '../../context/ToastContext';
import {
  CATEGORY_BADGE, CATEGORY_LABEL, DIFFICULTY_BADGE, sportBadge, SPORT_SHORT, instructionSteps,
} from './drillUtils';
import type { Drill } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drill: Drill | null;
  canAssign?: boolean;
  onAssign?: (drill: Drill) => void;
  onEdit?: (drill: Drill) => void;
}

export function DrillDetailModal({ isOpen, onClose, drill, canAssign, onAssign, onEdit }: Props) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const toggleFav = useToggleDrillFavorite();
  const del = useDeleteDrill();
  // Fetch fresh detail for usage stats (the list payload doesn't include them).
  const { data: detail } = useDrill(isOpen ? drill?.id : undefined);

  if (!drill) return null;
  const steps = instructionSteps(drill.instructions);
  const usage = detail?.usage;

  async function handleDelete() {
    if (!drill || !confirm(tr('drills.deleteConfirm', 'Delete drill "{{name}}"?', { name: drill.name }))) return;
    try {
      await del.mutateAsync(drill.id);
      addToast(tr('drills.drillDeleted', 'Drill deleted'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('common.failed', 'Failed'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={drill.name} size="lg">
      <div className="space-y-5">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {drill.sportIds.map(id => (
            <span key={id} className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', sportBadge(id))}>
              {L.sport(SPORT_SHORT[id] ?? drill.sportNames[0])}
            </span>
          ))}
          <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', DIFFICULTY_BADGE[drill.difficulty])}>{L.difficulty(drill.difficulty)}</span>
          <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', CATEGORY_BADGE[drill.category])}>{L.category(CATEGORY_LABEL[drill.category])}</span>
          {drill.isCustom && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{tr('drills.custom', 'Custom')}</span>}
        </div>

        {drill.description && <p className="text-sm text-gray-600 dark:text-gray-300">{drill.description}</p>}

        {/* Usage stats */}
        {usage && usage.timesAssigned > 0 && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 border-y border-gray-100 dark:border-gray-700/60 py-2">
            <span>{tr('drills.assignedLabel', 'Assigned')} <span className="font-semibold text-gray-700 dark:text-gray-200">{usage.timesAssigned}</span> {tr('drills.timesLabel', 'times')}</span>
            <span>{tr('drills.completionRateLabel', 'Completion rate')} <span className="font-semibold text-gray-700 dark:text-gray-200">{usage.completionRate}%</span></span>
            {usage.playerCount > 0 && <span>{tr('drills.usedByLabel', 'Used by')} <span className="font-semibold text-gray-700 dark:text-gray-200">{usage.playerCount}</span> {usage.playerCount === 1 ? tr('drills.playerOne', 'player') : tr('drills.playerOther', 'players')}</span>}
          </div>
        )}

        {/* Duration + equipment */}
        <div className="flex items-center gap-2 flex-wrap">
          {drill.durationMinutes != null && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              <Clock size={14} /> {tr('drills.minutesLong', '{{count}} minutes', { count: drill.durationMinutes })}
            </span>
          )}
          {drill.equipment && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              <Dumbbell size={14} /> {drill.equipment}
            </span>
          )}
        </div>

        {/* Instructions */}
        {steps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{tr('drills.instructions', 'Instructions')}</h4>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Target improvements */}
        {drill.targetStatCategories.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{tr('drills.targetsImprovement', 'Targets improvement in')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {drill.targetStatCategories.map(t => (
                <span key={t} className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {drill.videoUrl && (
          <a href={drill.videoUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300">
            <Play size={15} /> {tr('drills.watchVideo', 'Watch video')}
          </a>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <div className="flex items-center gap-2">
            <button onClick={() => toggleFav.mutate(drill.id)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                drill.isFavorited ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300')}>
              <Heart size={15} className={drill.isFavorited ? 'fill-red-500 text-red-500' : ''} /> {drill.isFavorited ? tr('drills.favorited', 'Favorited') : tr('drills.favorite', 'Favorite')}
            </button>
            {drill.isCustom && (
              <>
                <button onClick={() => onEdit?.(drill)} className="p-2 text-gray-400 hover:text-indigo-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={tr('common.edit', 'Edit')}><Pencil size={16} /></button>
                <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={tr('common.delete', 'Delete')}><Trash2 size={16} /></button>
              </>
            )}
          </div>
          {canAssign && (
            <Button onClick={() => onAssign?.(drill)}><Plus size={16} className="mr-1" /> {tr('drills.assignAsTask', 'Assign as Task')}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
