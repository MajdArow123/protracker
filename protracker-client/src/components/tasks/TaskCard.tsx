import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, Pencil, Trash2, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { PlayerTask } from '../../types';
import { PRIORITY_BADGE, CATEGORY_BADGE, isOverdue, formatDate, getInitials } from './taskUtils';

interface Props {
  task: PlayerTask;
  showPlayer?: boolean;
  // Coach actions
  onEdit?: () => void;
  onDelete?: () => void;
  // Athlete actions
  onComplete?: (note: string) => void;
  onIncomplete?: () => void;
  isMutating?: boolean;
}

export function TaskCard({ task, showPlayer, onEdit, onDelete, onComplete, onIncomplete, isMutating }: Props) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const overdue = isOverdue(task);

  function submitComplete() {
    onComplete?.(note.trim());
    setNote('');
    setNoteOpen(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'rounded-2xl border bg-white dark:bg-gray-900 p-4',
        task.isCompleted
          ? 'border-gray-200 dark:border-gray-800 opacity-80'
          : overdue
            ? 'border-red-300 dark:border-red-900/50'
            : 'border-gray-200 dark:border-gray-800',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Completion status icon */}
        <div className="mt-0.5 flex-shrink-0">
          {task.isCompleted
            ? <CheckCircle2 size={20} className="text-green-500" />
            : <Circle size={20} className="text-gray-300 dark:text-gray-600" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Player row (coach views) */}
          {showPlayer && (
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[10px] font-black flex-shrink-0">
                {getInitials(task.playerName)}
              </div>
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{task.playerName}</span>
            </div>
          )}

          {/* Title + badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={clsx(
                  'font-bold text-sm',
                  task.isCompleted ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white',
                )}>
                  {task.title}
                </p>
                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', CATEGORY_BADGE[task.category])}>
                  {task.category}
                </span>
                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRIORITY_BADGE[task.priority])}>
                  {task.priority}
                </span>
              </div>

              {task.dueDate && (
                <div className={clsx(
                  'flex items-center gap-1 mt-1 text-xs font-medium',
                  overdue ? 'text-red-500' : 'text-gray-500 dark:text-gray-400',
                )}>
                  <Clock size={12} />
                  <span>{overdue ? 'Overdue · ' : 'Due '}{formatDate(task.dueDate)}</span>
                </div>
              )}
            </div>

            {/* Coach action buttons */}
            {(onEdit || onDelete) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"
                    aria-label="Edit task"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                    aria-label="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className={clsx(
              'text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed',
              !task.isCompleted && 'line-clamp-2',
            )}>
              {task.description}
            </p>
          )}

          {/* Completed banner */}
          {task.isCompleted && (
            <div className="mt-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                  Completed by {task.playerName}{task.completedAt ? ` on ${formatDate(task.completedAt)}` : ''}
                </p>
                {onIncomplete && (
                  <button
                    onClick={onIncomplete}
                    disabled={isMutating}
                    className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Undo2 size={11} /> Undo
                  </button>
                )}
              </div>
              {task.completedNote && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">“{task.completedNote}”</p>
              )}
            </div>
          )}

          {/* Athlete: mark complete */}
          {!task.isCompleted && onComplete && (
            <div className="mt-3">
              {noteOpen ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder="Add a note (optional)…"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={submitComplete}
                      disabled={isMutating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Confirm Complete
                    </button>
                    <button
                      onClick={() => { setNoteOpen(false); setNote(''); }}
                      className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNoteOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900/30 text-gray-700 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 text-xs font-semibold transition-all cursor-pointer"
                >
                  <CheckCircle2 size={13} /> Mark Complete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
