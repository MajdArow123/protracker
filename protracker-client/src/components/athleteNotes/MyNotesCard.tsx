import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { NotebookPen, Plus, ArrowRight, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { useAthleteNotes, useCreateAthleteNote } from '../../hooks/useAthleteNotes';
import { AthleteNoteModal } from './AthleteNoteModal';
import { NOTE_CATEGORY_STYLES, noteTitleOf } from './noteMeta';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

// Dashboard widget: quick-jot box + last 3 notes + "view all" link. `notesPath` differs
// for team athletes (/player-dashboard/notes) vs solo (/solo/notes).
export function MyNotesCard({ notesPath, enabled = true }: { notesPath: string; enabled?: boolean }) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { data: notes = [] } = useAthleteNotes(enabled);
  const createNote = useCreateAthleteNote();

  const [quick, setQuick] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const saveQuick = async () => {
    if (!quick.trim()) return;
    try {
      await createNote.mutateAsync({ content: quick.trim(), category: 'Personal', title: null });
      setQuick('');
      addToast(t('notes.noteSaved', 'Note saved'), 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('notes.failedSave', 'Failed to save'), 'error');
    }
  };

  const recent = notes.slice(0, 3);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} className="text-indigo-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">{t('nav.notes', 'My Notes')}</h2>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-gray-400"><Lock size={11} /> {t('notes.private', 'Private')}</span>
      </div>

      {/* Quick-jot */}
      <div className="flex gap-2 mb-4">
        <input
          value={quick}
          onChange={e => setQuick(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveQuick(); } }}
          placeholder={t('notes.contentPlaceholder', 'Jot something down…')}
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button onClick={saveQuick} disabled={!quick.trim()} isLoading={createNote.isPending}>
          <Plus size={15} />
        </Button>
      </div>

      {recent.length === 0 ? (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full text-sm text-gray-400 hover:text-indigo-500 py-3 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 cursor-pointer transition-colors"
        >
          {t('notes.writeFirst', 'Write your first note')}
        </button>
      ) : (
        <div className="space-y-2">
          {recent.map(n => (
            <button
              key={n.id}
              onClick={() => navigate(notesPath)}
              className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-all text-left cursor-pointer"
            >
              <span className={clsx('text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0', NOTE_CATEGORY_STYLES[n.category])}>{L.category(n.category)}</span>
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{noteTitleOf(n, t('notes.untitled', 'Untitled note'))}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(n.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate(notesPath)}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:gap-1.5 transition-all mt-3 cursor-pointer"
      >
        {t('notes.viewAll', 'View all notes')} <ArrowRight size={13} />
      </button>

      <AthleteNoteModal note={null} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
