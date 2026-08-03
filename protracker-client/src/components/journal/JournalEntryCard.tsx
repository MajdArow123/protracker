import { useState } from 'react';
import { Lock, Pencil, Trash2, ChevronDown, ChevronUp, Star, Lightbulb, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { useDeleteJournal } from '../../hooks/useJournal';
import { useToast } from '../../context/useToast';
import { MOOD_CONFIG, parseTags, dateKey } from './journalUtils';
import type { JournalEntry } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface Props {
  entry: JournalEntry;
  canManage?: boolean;
  onEdit?: (entry: JournalEntry) => void;
}

export function JournalEntryCard({ entry, canManage, onEdit }: Props) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();
  const del = useDeleteJournal();
  const [expanded, setExpanded] = useState(false);

  const cfg = MOOD_CONFIG[entry.mood];
  const Icon = cfg.icon;
  const tags = parseTags(entry.tags);
  const title = entry.title || tr('journal.autoTitle', '{{mood}} day — {{date}}', {
    mood: L.mood(entry.mood),
    date: formatDate(entry.entryDate, { month: 'short', day: 'numeric' }),
  });

  async function handleDelete() {
    if (!confirm(tr('journal.deleteConfirm', 'Delete this journal entry?'))) return;
    try {
      await del.mutateAsync(entry.id);
      addToast(tr('journal.entryDeleted', 'Entry deleted'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('common.failed', 'Failed'), 'error');
    }
  }

  const hasExtra = !!(entry.keyLearning || entry.tomorrowFocus || (entry.content && entry.content.length > 180));

  return (
    <div id={`journal-${dateKey(new Date(entry.entryDate))}`} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 scroll-mt-24">
      <div className="flex items-start gap-3">
        {/* Mood icon */}
        <div className={clsx('flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', cfg.bg)}>
          <Icon size={20} className={cfg.color} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {entry.isPrivate && <Lock size={12} className="text-gray-400" />}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatDate(entry.entryDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="inline-flex items-center gap-1">
              {tr('journal.energy', 'Energy')}
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className={clsx('w-1.5 h-1.5 rounded-full', n <= entry.energyLevel ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-600')} />
                ))}
              </span>
            </span>
            {entry.trainingRating != null && (
              <span className="inline-flex items-center gap-0.5"><Star size={11} className="text-amber-400 fill-amber-400" /> {entry.trainingRating}/5</span>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onEdit?.(entry)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={tr('common.edit', 'Edit')}><Pencil size={15} /></button>
            <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" title={tr('common.delete', 'Delete')}><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      {entry.content && (
        <p className={clsx('mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap', !expanded && 'line-clamp-3')}>{entry.content}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2">
          {entry.keyLearning && (
            <div className="flex gap-2 text-sm">
              <Lightbulb size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-gray-600 dark:text-gray-300"><span className="font-medium text-gray-700 dark:text-gray-200">{tr('journal.keyLearningLabel', 'Key learning: ')}</span>{entry.keyLearning}</p>
            </div>
          )}
          {entry.tomorrowFocus && (
            <div className="flex gap-2 text-sm">
              <Target size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-gray-600 dark:text-gray-300"><span className="font-medium text-gray-700 dark:text-gray-200">{tr('journal.tomorrowLabel', 'Tomorrow: ')}</span>{entry.tomorrowFocus}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">#{tag}</span>
            ))}
          </div>
        ) : <span />}
        {hasExtra && (
          <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline cursor-pointer flex-shrink-0">
            {expanded ? <>{tr('common.less', 'Less')} <ChevronUp size={13} /></> : <>{tr('common.more', 'More')} <ChevronDown size={13} /></>}
          </button>
        )}
      </div>
    </div>
  );
}
