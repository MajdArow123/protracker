import { useState } from 'react';
import { BookOpen, Plus, PenLine, Check } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { JournalEntryCard } from '../../components/journal/JournalEntryCard';
import { JournalEntryModal } from '../../components/journal/JournalEntryModal';
import { JournalHeatMap } from '../../components/journal/JournalHeatMap';
import { MOOD_CONFIG } from '../../components/journal/journalUtils';
import { useMyJournal, useTodayJournal } from '../../hooks/useJournal';
import type { JournalEntry } from '../../types';

export function JournalPage() {
  const journalQuery = useMyJournal(90);
  const { data: today } = useTodayJournal();
  const entries = journalQuery.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  function writeToday() {
    setEditing(today ?? null); // edit today's entry if it exists, else fresh
    setModalOpen(true);
  }
  function openEdit(entry: JournalEntry) {
    setEditing(entry);
    setModalOpen(true);
  }

  function scrollToDate(key: string) {
    document.getElementById(`journal-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const wroteToday = !!today;

  const actions = (
    <Button onClick={writeToday}>
      {wroteToday ? <><PenLine size={16} className="mr-1.5" /> Edit Today</> : <><Plus size={16} className="mr-1.5" /> Write Today's Entry</>}
    </Button>
  );

  return (
    <PageWrapper title="My Journal" actions={actions}>
      {journalQuery.isLoading ? (
        <CardListSkeleton count={3} />
      ) : journalQuery.isError ? (
        <ErrorState onRetry={() => journalQuery.refetch()} />
      ) : (
        <div className="space-y-6">
          {/* Today status banner */}
          {wroteToday ? (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <Check size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Nice work journaling today!</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  You felt <span className={MOOD_CONFIG[today!.mood].color}>{today!.mood.toLowerCase()}</span> today.
                </p>
              </div>
            </div>
          ) : (
            <button onClick={writeToday} className="w-full flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl px-4 py-3 text-left hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <PenLine size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Write today's entry</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reflect on your training and how you're feeling.</p>
              </div>
            </button>
          )}

          {/* Heat map */}
          {entries.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Last 3 months</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <JournalHeatMap entries={entries} onSelectDate={scrollToDate} />
            </div>
          )}

          {/* Entry list */}
          {entries.length === 0 ? (
            <EmptyState
              icon={<BookOpen />}
              title="Your journal is empty"
              description="Start reflecting on your training — one entry a day builds a powerful record of your growth."
              action={{ label: "Write Today's Entry", onClick: writeToday }}
            />
          ) : (
            <div className="space-y-3">
              {entries.map(e => (
                <JournalEntryCard key={e.id} entry={e} canManage onEdit={openEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      <JournalEntryModal isOpen={modalOpen} onClose={() => setModalOpen(false)} entry={editing} />
    </PageWrapper>
  );
}
