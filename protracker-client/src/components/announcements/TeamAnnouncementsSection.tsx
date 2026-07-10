import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Pencil, Trash2, Pin, Megaphone, AlertTriangle } from 'lucide-react';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useTeamAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from '../../hooks/useAnnouncements';
import type { TeamAnnouncement, AnnouncementPriority } from '../../types';

const PRIORITIES: AnnouncementPriority[] = ['Normal', 'Important', 'Urgent'];

const PRIORITY_STYLES: Record<AnnouncementPriority, { border: string; badge: string; accent: string }> = {
  Normal: { border: 'border-gray-200 dark:border-gray-800', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', accent: '' },
  Important: { border: 'border-amber-300 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', accent: 'bg-amber-500' },
  Urgent: { border: 'border-red-300 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', accent: 'bg-red-500' },
};

function fmt(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AnnouncementModal({ teamId, announcement, isOpen, onClose }: {
  teamId: number; announcement: TeamAnnouncement | null; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const createA = useCreateAnnouncement();
  const updateA = useUpdateAnnouncement();
  const isEdit = !!announcement;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('Normal');
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setTitle(announcement?.title ?? '');
    setContent(announcement?.content ?? '');
    setPriority(announcement?.priority ?? 'Normal');
    setIsPinned(announcement?.isPinned ?? false);
  }, [isOpen, announcement]);

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return; }
    const payload = { title: title.trim(), content: content.trim(), priority, isPinned };
    try {
      if (isEdit && announcement) {
        await updateA.mutateAsync({ id: announcement.id, data: payload });
        addToast('Announcement updated', 'success');
      } else {
        await createA.mutateAsync({ teamId, data: payload });
        addToast('Announcement posted', 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  const saving = createA.isPending || updateA.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Announcement' : 'New Announcement'}>
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Match time changed" />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Announcement details…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map(p => (
              <button key={p} type="button" onClick={() => setPriority(p)}
                className={clsx('py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                  priority === p ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
          <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1"><Pin size={13} /> Pin to top</span>
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={saving}>{isEdit ? 'Save Changes' : 'Post'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function TeamAnnouncementsSection({ teamId, isCoach }: { teamId: number; isCoach: boolean; }) {
  const { data: announcements = [], isLoading } = useTeamAnnouncements(teamId);
  const deleteA = useDeleteAnnouncement();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<TeamAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamAnnouncement | null>(null);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Megaphone size={16} className="text-indigo-400" /> Announcements</h3>
        {isCoach && (
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer">
            <Plus size={13} /> New
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone size={32} />} title="No announcements" description={isCoach ? 'Post an update for your team.' : 'No announcements yet.'} size="sm" />
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const st = PRIORITY_STYLES[a.priority];
            return (
              <div key={a.id} className={clsx('group relative rounded-xl border p-4 overflow-hidden', st.border)}>
                {st.accent && <div className={clsx('absolute start-0 top-0 bottom-0 w-1', st.accent)} />}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.isPinned && <Pin size={13} className="text-indigo-500 flex-shrink-0" />}
                    {a.priority === 'Urgent' && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{a.title}</h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', st.badge)}>{a.priority}</span>
                    {isCoach && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(a); setModalOpen(true); }} className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 cursor-pointer"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteTarget(a)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
                {a.content && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{a.content}</p>}
                <p className="text-[11px] text-gray-400 mt-2">{a.coachName || 'Coach'} · {fmt(a.createdAt)}{a.updatedAt ? ' · edited' : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {isCoach && (
        <>
          <AnnouncementModal teamId={teamId} announcement={editItem} isOpen={modalOpen}
            onClose={() => { setModalOpen(false); setEditItem(null); }} />
          <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
            onConfirm={async () => { if (!deleteTarget) return; try { await deleteA.mutateAsync(deleteTarget.id); addToast('Announcement deleted', 'success'); } catch (err) { addToast(err instanceof Error ? err.message : 'Delete failed', 'error'); } finally { setDeleteTarget(null); } }}
            title="Delete Announcement" message={`Delete "${deleteTarget?.title}"?`} confirmLabel="Delete" isLoading={deleteA.isPending} />
        </>
      )}
    </div>
  );
}
