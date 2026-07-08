import { BookOpen, Lock } from 'lucide-react';
import { usePlayerJournal } from '../../hooks/useJournal';
import { JournalEntryCard } from './JournalEntryCard';
import { JournalHeatMap } from './JournalHeatMap';
import { EmptyState } from '../ui/EmptyState';
import { CardListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';

interface Props {
  playerId: number;
}

// Coach's read-only view of a player's journal. Only shared (non-private) entries are ever
// returned by the API, so nothing here can leak a private entry.
export function CoachJournalTab({ playerId }: Props) {
  const query = usePlayerJournal(playerId);
  const entries = query.data ?? [];

  if (query.isLoading) return <CardListSkeleton count={2} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
        <Lock size={13} className="flex-shrink-0 mt-0.5" />
        <span>You only see entries the athlete has chosen to share. Private entries are never visible.</span>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={<BookOpen />} title="No shared entries" description="This athlete hasn't shared any journal entries yet." />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <JournalHeatMap entries={entries} />
          </div>
          <div className="space-y-3">
            {entries.map(e => <JournalEntryCard key={e.id} entry={e} />)}
          </div>
        </>
      )}
    </div>
  );
}
