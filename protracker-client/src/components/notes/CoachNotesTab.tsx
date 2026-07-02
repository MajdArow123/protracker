import { useState } from 'react';
import { clsx } from 'clsx';
import { Plus, Pencil, Trash2, Lock, Eye, StickyNote } from 'lucide-react';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useCoachNotes, useCreateCoachNote, useUpdateCoachNote, useDeleteCoachNote } from '../../hooks/useCoachNotes';
import type { CoachNote, CoachNoteCategory } from '../../types';

const CATEGORIES: CoachNoteCategory[] = ['General', 'Performance', 'Attitude', 'Development', 'Tactical', 'Medical'];

const CATEGORY_STYLES: Record<CoachNoteCategory, string> = {
  General: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Performance: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  Attitude: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Development: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Tactical: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Medical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function NoteModal({ playerId, note, isOpen, onClose }: {
  playerId: number; note: CoachNote | null; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const createNote = useCreateCoachNote();
  const updateNote = useUpdateCoachNote(playerId);
  const isEdit = !!note;

  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CoachNoteCategory>('General');
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState('');

  // Reset fields whenever the modal opens for a new/different note.
  const [lastKey, setLastKey] = useState<string>('');
  const key = `${isOpen}-${note?.id ?? 'new'}`;
  if (isOpen && key !== lastKey) {
    setLastKey(key);
    setContent(note?.content ?? '');
    setCategory(note?.category ?? 'General');
    setIsPrivate(note?.isPrivate ?? true);
    setError('');
  }

  async function handleSubmit() {
    if (!content.trim()) { setError('Note content is required'); return; }
    const payload = { content: content.trim(), category, isPrivate };
    try {
      if (isEdit && note) {
        await updateNote.mutateAsync({ id: note.id, data: payload });
        addToast('Note updated', 'success');
      } else {
        await createNote.mutateAsync({ playerId, data: payload });
        addToast('Note added', 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  const saving = createNote.isPending || updateNote.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Note' : 'Add Note'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={clsx('py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                  category === c ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy pill toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visibility</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsPrivate(true)}
              className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                isPrivate ? 'bg-gray-700 text-white border-transparent dark:bg-gray-600' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
              <Lock size={13} /> Private (only you)
            </button>
            <button type="button" onClick={() => setIsPrivate(false)}
              className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                !isPrivate ? 'bg-green-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
              <Eye size={13} /> Share with athlete
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} autoFocus placeholder="Observation about this player…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={saving}>{isEdit ? 'Save Changes' : 'Add Note'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function CoachNotesTab({ playerId }: { playerId: number }) {
  const { data: notes = [], isLoading } = useCoachNotes(playerId);
  const updateNote = useUpdateCoachNote(playerId);
  const deleteNote = useDeleteCoachNote(playerId);
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<CoachNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoachNote | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function togglePrivacy(n: CoachNote) {
    setTogglingId(n.id);
    try {
      await updateNote.mutateAsync({ id: n.id, data: { content: n.content, category: n.category, isPrivate: !n.isPrivate } });
      addToast(n.isPrivate ? 'Note shared with athlete' : 'Note set to private', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 dark:text-white">Notes</h3>
        <button onClick={() => { setEditNote(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer">
          <Plus size={13} /> Add Note
        </button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <Lock size={12} /> Private notes are coach-only. Shared notes appear in the athlete's Coach Feedback.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : notes.length === 0 ? (
        <EmptyState icon={<StickyNote size={32} />} title="No notes yet" description="Add a note about this player." size="sm" />
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', CATEGORY_STYLES[n.category])}>{n.category}</span>
                  {/* Privacy badge — click to toggle */}
                  <button
                    onClick={() => togglePrivacy(n)}
                    disabled={togglingId === n.id}
                    title={n.isPrivate ? 'Click to share with athlete' : 'Click to make private'}
                    className={clsx(
                      'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer disabled:opacity-50',
                      n.isPrivate
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50',
                    )}>
                    {n.isPrivate ? <Lock size={10} /> : <Eye size={10} />}
                    {n.isPrivate ? 'Private' : 'Shared'}
                  </button>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditNote(n); setModalOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(n)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{n.content}</p>
              <p className="text-[11px] text-gray-400 mt-2">
                {n.coachName || 'Coach'} · {fmtDateTime(n.createdAt)}{n.updatedAt ? ' · edited' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      <NoteModal playerId={playerId} note={editNote} isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditNote(null); }} />
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (!deleteTarget) return; try { await deleteNote.mutateAsync(deleteTarget.id); addToast('Note deleted', 'success'); } catch (err) { addToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteTarget(null); } }}
        title="Delete Note" message="Delete this note?" confirmLabel="Delete" isLoading={deleteNote.isPending} />
    </div>
  );
}
