import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, History, PlusCircle, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { useLineupAudit } from '../../../hooks/useLineup';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import { Skeleton } from '../../ui/Skeleton';
import { lineupApi, type LineupAuditEntryDto } from '../../../api/lineupApi';

interface Props {
  teamId: number;
}

const ACTION_ICON: Record<string, typeof Save> = {
  created: PlusCircle,
  saved: Save,
  published: Send,
  unpublished: Undo2,
  deleted: Trash2,
};

// Read-only lineup change audit (Phase 6, blueprint §7-challenge-3): who /
// when / a REAL-diff summary per row. Collapsible panel, the
// SquadAnalysisPanel shape, view mode only. KeyLabel + summary are
// backend-generated English (the NotificationDto precedent — data, not i18n).
// Restore / version-compare are deliberately absent (deferred).
export function LineupAuditPanel({ teamId }: Props) {
  const { t } = useTranslation();
  const { formatRelativeTime } = useLocaleFormat();
  const [open, setOpen] = useState(false);
  // Page 1 is a live query (invalidated on every lineup mutation); older pages
  // are append-only history fetched imperatively — audit rows never change.
  const audit = useLineupAudit(teamId, 1, open);
  const [olderRows, setOlderRows] = useState<LineupAuditEntryDto[]>([]);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);

  const firstIds = new Set((audit.data?.items ?? []).map(r => r.id));
  const rows: LineupAuditEntryDto[] = [
    ...(audit.data?.items ?? []),
    ...olderRows.filter(r => !firstIds.has(r.id)),
  ];
  const totalCount = audit.data?.totalCount ?? 0;
  const hasMore = rows.length < totalCount;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await lineupApi.audit(teamId, { page: nextPage });
      setOlderRows(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...page.items.filter(r => !seen.has(r.id))];
      });
      setNextPage(p => p + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section
      aria-label={t('teams.lineupAuditTitle', 'Lineup history')}
      className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <History size={15} className="text-gray-400" />
          {t('teams.lineupAuditTitle', 'Lineup history')}
          {audit.data != null && (
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{totalCount}</span>
          )}
        </span>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {audit.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          ) : audit.isError ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              {t('teams.lineupAuditError', "Couldn't load the history.")}
              <button
                type="button"
                onClick={() => void audit.refetch()}
                className="text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('teams.lineupAuditEmpty', 'No changes recorded yet.')}
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {rows.map(row => {
                  const Icon = ACTION_ICON[row.action] ?? History;
                  return (
                    <li
                      key={row.id}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60"
                    >
                      <Icon
                        size={14}
                        aria-hidden
                        className={clsx(
                          'mt-0.5 shrink-0',
                          row.action === 'deleted' ? 'text-rose-500'
                            : row.action === 'published' ? 'text-emerald-500'
                            : 'text-gray-400',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-900 dark:text-white">
                          {/* Backend English data — rendered verbatim, like notifications. */}
                          <span className="font-semibold">{row.keyLabel}</span>
                          <span className="text-gray-500 dark:text-gray-400"> · {row.summary}</span>
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {row.changedByName} · {formatRelativeTime(row.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 disabled:opacity-50 cursor-pointer"
                >
                  {t('teams.lineupAuditMore', 'Load more')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
