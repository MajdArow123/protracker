import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAssignDrill } from '../../hooks/useDrills';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_LABEL, CATEGORY_BADGE, DIFFICULTY_BADGE } from './drillUtils';
import type { Drill, TaskPriority } from '../../types';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drill: Drill | null;
  players: PlayerOption[];
  lockedPlayerId?: number; // solo athlete or assigning from a player page
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];
const PRIORITY_PILL: Record<TaskPriority, string> = {
  Low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function AssignDrillModal({ isOpen, onClose, drill, players, lockedPlayerId }: Props) {
  const { addToast } = useToast();
  const assign = useAssignDrill();

  const [playerId, setPlayerId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPlayerId(lockedPlayerId ?? '');
      setDueDate('');
      setPriority('Medium');
      setNote('');
    }
  }, [isOpen, lockedPlayerId]);

  if (!drill) return null;

  async function handleAssign() {
    if (!drill) return;
    const pid = lockedPlayerId ?? (playerId ? Number(playerId) : null);
    if (!pid) { addToast('Select a player', 'error'); return; }
    try {
      await assign.mutateAsync({ id: drill.id, data: { playerId: pid, dueDate: dueDate || null, priority, note: note.trim() || null } });
      addToast(`Assigned "${drill.name}"`, 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to assign drill', 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign as Task">
      <div className="space-y-4">
        {/* Drill summary */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{drill.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', DIFFICULTY_BADGE[drill.difficulty])}>{drill.difficulty}</span>
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORY_BADGE[drill.category])}>{CATEGORY_LABEL[drill.category]}</span>
          </div>
        </div>

        {!lockedPlayerId && (
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Player</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : '')}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">Select a player…</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</p>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p} type="button" onClick={() => setPriority(p)}
                className={clsx('px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                  priority === p ? PRIORITY_PILL[p] + ' ring-2 ring-offset-1 ring-current dark:ring-offset-gray-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:opacity-80')}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <Input label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Add coaching points — prepended to the drill instructions."
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={assign.isPending}>{assign.isPending ? 'Assigning…' : 'Assign'}</Button>
        </div>
      </div>
    </Modal>
  );
}
