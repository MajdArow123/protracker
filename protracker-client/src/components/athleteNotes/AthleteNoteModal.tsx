import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { Check, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useCreateAthleteNote, useUpdateAthleteNote } from '../../hooks/useAthleteNotes';
import { NOTE_CATEGORIES, NOTE_CATEGORY_STYLES } from './noteMeta';
import type { AthleteNote, AthleteNoteCategory } from '../../types';

export function AthleteNoteModal({ note, isOpen, onClose }: {
  note: AthleteNote | null; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const createNote = useCreateAthleteNote();
  const updateNote = useUpdateAthleteNote();

  const [id, setId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AthleteNoteCategory>('Personal');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Snapshot of what's currently persisted, so auto-save only fires on real changes.
  const savedRef = useRef('');

  useEffect(() => {
    if (!isOpen) return;
    setId(note?.id ?? null);
    setTitle(note?.title ?? '');
    setCategory(note?.category ?? 'Personal');
    setContent(note?.content ?? '');
    setError('');
    setAutoState('idle');
    savedRef.current = JSON.stringify({ t: note?.title ?? '', c: note?.content ?? '', cat: note?.category ?? 'Personal' });
  }, [isOpen, note]);

  // Persist current values (create on first save, update thereafter). Returns silently
  // if content is empty or nothing changed.
  const persist = useCallback(async (viaAuto: boolean) => {
    if (!content.trim()) {
      if (!viaAuto) setError('Write something before saving.');
      return;
    }
    const snapshot = JSON.stringify({ t: title, c: content, cat: category });
    if (viaAuto && snapshot === savedRef.current) return;

    setError('');
    if (viaAuto) setAutoState('saving');
    const payload = { title: title.trim() || null, content: content.trim(), category };
    try {
      if (id == null) {
        const created = await createNote.mutateAsync(payload);
        setId(created.id);
      } else {
        await updateNote.mutateAsync({ id, data: payload });
      }
      savedRef.current = snapshot;
      if (viaAuto) { setAutoState('saved'); setTimeout(() => setAutoState('idle'), 2000); }
      return true;
    } catch (e) {
      if (viaAuto) setAutoState('idle');
      setError(e instanceof Error ? e.message : 'Failed to save note.');
      return false;
    }
  }, [content, title, category, id, createNote, updateNote]);

  // Auto-save every 30s while the modal is open and there's content.
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => { void persist(true); }, 30000);
    return () => clearInterval(t);
  }, [isOpen, persist]);

  const handleSave = async () => {
    const ok = await persist(false);
    if (ok) {
      addToast('Note saved', 'success');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={note ? 'Edit note' : 'New note'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title <span className="text-gray-400 font-normal">(optional)</span></label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give it a title…" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
          <div className="flex flex-wrap gap-2">
            {NOTE_CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  category === c
                    ? `${NOTE_CATEGORY_STYLES[c]} border-transparent ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-gray-900`
                    : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Note</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
            placeholder="Jot something down…"
            autoFocus
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            {autoState === 'saving' && (<><Loader2 size={13} className="animate-spin" /> Auto-saving…</>)}
            {autoState === 'saved' && (<><Check size={13} className="text-emerald-500" /> Auto-saved</>)}
            {autoState === 'idle' && 'Auto-saves every 30s'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={handleSave} isLoading={createNote.isPending || updateNote.isPending}>Save</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
