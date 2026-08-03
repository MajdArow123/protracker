import { useState } from 'react';
import { clsx } from 'clsx';
import { Plus, Pencil, Trash2, NotebookPen, Lock } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../context/useToast';
import { useAthleteNotes, useDeleteAthleteNote } from '../../hooks/useAthleteNotes';
import { AthleteNoteModal } from '../../components/athleteNotes/AthleteNoteModal';
import { NOTE_CATEGORIES, NOTE_CATEGORY_STYLES, noteTitleOf } from '../../components/athleteNotes/noteMeta';
import type { AthleteNote, AthleteNoteCategory } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

export function AthleteNotesPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();
  const { data: notes = [], isLoading, isError, refetch } = useAthleteNotes();
  const deleteNote = useDeleteAthleteNote();

  const [filter, setFilter] = useState<AthleteNoteCategory | 'All'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AthleteNote | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AthleteNote | null>(null);

  const visible = filter === 'All' ? notes : notes.filter(n => n.category === filter);
  const counts = notes.reduce((acc, n) => { acc[n.category] = (acc[n.category] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (n: AthleteNote) => { setEditing(n); setModalOpen(true); };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNote.mutateAsync(deleteTarget.id);
      addToast(t('notes.noteDeleted', 'Note deleted'), 'success');
      setDeleteTarget(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('notes.deleteFailed', 'Delete failed'), 'error');
    }
  };

  const actions = (
    <button
      onClick={openNew}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
    >
      <Plus size={15} /> {t('notes.newNote', 'New Note')}
    </button>
  );

  return (
    <PageWrapper title={t('nav.notes', 'My Notes')} actions={actions}>
      <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4 -mt-2">
        <Lock size={12} /> {t('notes.privateNotice', 'Private to you — your coach can never see these.')}
      </p>

      {/* Category filter pills */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilter('All')}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
              filter === 'All' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}
          >
            {t('common.all', 'All')} {notes.length}
          </button>
          {NOTE_CATEGORIES.filter(c => counts[c]).map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                filter === c ? `${NOTE_CATEGORY_STYLES[c]} ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-gray-900` : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}
            >
              {L.category(c)} {counts[c]}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <CardListSkeleton count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={32} />}
          title={t('notes.noNotes', 'No notes yet')}
          description={t('notes.emptyDesc', 'Keep private notes on your training, nutrition, mindset and goals — just for you.')}
          action={{ label: t('notes.writeFirst', 'Write your first note'), onClick: openNew }}
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map(n => {
            const isOpen = expanded === n.id;
            return (
              <div key={n.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <button
                  onClick={() => setExpanded(isOpen ? null : n.id)}
                  className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-semibold', NOTE_CATEGORY_STYLES[n.category])}>{L.category(n.category)}</span>
                      <span className="text-[11px] text-gray-400">{formatDate(n.updatedAt)}</span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{noteTitleOf(n, t('notes.untitled', 'Untitled note'))}</p>
                    {!isOpen && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{n.content}</p>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-3">{n.content}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                      >
                        <Pencil size={13} /> {t('common.edit', 'Edit')}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} /> {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">{t('notes.noCategoryNotes', 'No {{category}} notes yet.', { category: (filter === 'All' ? filter : L.category(filter)).toLowerCase() })}</p>
          )}
        </div>
      )}

      <AthleteNoteModal note={editing} isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} />
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title={t('notes.deleteNote', 'Delete note')}
        message={t('notes.deleteConfirm', "Delete this note? This can't be undone.")}
        confirmLabel={t('common.delete', 'Delete')}
        isLoading={deleteNote.isPending}
      />
    </PageWrapper>
  );
}
