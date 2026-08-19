import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { seasonsApi } from '../../api/seasonsApi';
import type { Season, ConfirmRosterResult } from '../../types';

const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// §5d Q1: bulk historical confirmation. The honesty rules, all pinned:
// - Every date is typed or picked by the coach — the date fields default to BLANK.
//   Season start and earliest recorded activity render as LABELED hints, never
//   prefills; the act of confirmation is the data's provenance.
// - "Apply to selected" is a bulk affordance over an explicit assertion, not a default.
// - On success, the Q8 pointer offers the S7 backfill preview — never auto-executes.
export function SeasonRosterConfirmModal({ season, onClose, onOpenBackfill }: {
  season: Season;
  onClose: () => void;
  onOpenBackfill: () => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const { formatDate } = useLocaleFormat();
  const queryClient = useQueryClient();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [dates, setDates] = useState<Record<number, string>>({});
  const [bulkDate, setBulkDate] = useState('');
  const [result, setResult] = useState<ConfirmRosterResult | null>(null);

  const candidates = useQuery({
    queryKey: ['rosterCandidates', season.id],
    queryFn: () => seasonsApi.getRosterCandidates(season.id),
    staleTime: 0,
    gcTime: 0,
  });

  const confirm = useMutation({
    mutationFn: (entries: { playerId: number; joinedAt: string }[]) =>
      seasonsApi.confirmRoster(season.id, entries),
    onSuccess: data => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['season-roster'] });
      queryClient.invalidateQueries({ queryKey: ['rosterCandidates', season.id] });
    },
    onError: err => {
      const message = err instanceof Error && err.message
        ? err.message
        : tr('seasons.confirmRoster.errSave', 'Could not confirm the roster.');
      addToast(message, 'error');
    },
  });

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
  const multiTeam = new Set((candidates.data ?? []).map(c => c.teamId)).size > 1;

  function submit() {
    if (selectedIds.length === 0) {
      addToast(tr('seasons.confirmRoster.errNone', 'Select at least one player.'), 'error');
      return;
    }
    const missing = selectedIds.filter(id => !dates[id]);
    if (missing.length > 0) {
      addToast(tr('seasons.confirmRoster.errDates', 'Every selected player needs a joined-from date — that assertion is what makes the entry honest.'), 'error');
      return;
    }
    confirm.mutate(selectedIds.map(id => ({ playerId: id, joinedAt: dates[id] })));
  }

  return (
    <Modal isOpen onClose={onClose} title={tr('seasons.confirmRoster.title', 'Confirm historical roster')}>
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
            {tr('seasons.confirmRoster.done', '{{count}} roster entries added.', { count: result.createdCount })}
            {result.skippedAlreadyCovered > 0 && (
              <> {tr('seasons.confirmRoster.skipped', '{{count}} already had an entry and were left untouched.', { count: result.skippedAlreadyCovered })}</>
            )}
          </p>
          {result.unstampedInWindow > 0 && (
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 space-y-2">
              <p className="text-sm text-indigo-900 dark:text-indigo-100">
                {tr('seasons.confirmRoster.backfillPointer', '{{count}} previously unassigned records may now be assignable — run Backfill preview to see and confirm.', { count: result.unstampedInWindow })}
              </p>
              <Button type="button" size="sm" onClick={() => { onClose(); onOpenBackfill(); }}>
                <CalendarClock size={14} /> {tr('seasons.confirmRoster.openBackfill', 'Open Backfill preview')}
              </Button>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>{tr('common.close', 'Close')}</Button>
          </div>
        </div>
      ) : candidates.isLoading ? (
        <p className="text-sm text-gray-400 py-4">{tr('common.loading', 'Loading...')}</p>
      ) : candidates.isError ? (
        // A load failure is never an "everyone is covered" claim.
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
          {tr('seasons.confirmRoster.errLoad', "Couldn't load the players.")}{' '}
          <button onClick={() => candidates.refetch()} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
            {tr('common.retry', 'Retry')}
          </button>
        </p>
      ) : candidates.data!.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tr('seasons.confirmRoster.empty', 'Everyone currently on the participating teams already has a roster entry for this season.')}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>{tr('common.close', 'Close')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tr('seasons.confirmRoster.intro', 'State who was on the roster and from when. Dates are deliberately not pre-filled — you were there, the system was not. Records are not re-assigned by this; backfill runs separately afterwards.')}
          </p>
          {/* Labeled reference hint — display only, never a prefill. */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr('seasons.confirmRoster.seasonWindow', 'For reference: this season runs {{start}} – {{end}}.', {
              start: fmtDate(season.startDate), end: fmtDate(season.endDate),
            })}
          </p>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="bulk-joined-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tr('seasons.confirmRoster.bulkDate', 'Joined from (apply to selected)')}
              </label>
              <input id="bulk-joined-date" type="date" className={inputClass} value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!bulkDate || selectedIds.length === 0}
              onClick={() => setDates(d => {
                const next = { ...d };
                for (const id of selectedIds) next[id] = bulkDate;
                return next;
              })}
            >
              {tr('seasons.confirmRoster.applyToSelected', 'Apply to selected')}
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {candidates.data!.map(c => (
              <div key={c.playerId} className="px-3 py-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                  checked={!!selected[c.playerId]}
                  onChange={e => setSelected(s => ({ ...s, [c.playerId]: e.target.checked }))}
                  aria-label={c.playerName}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {c.playerName}
                    {multiTeam && <span className="text-xs text-gray-400 font-normal"> · {c.teamName}</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {c.earliestActivity
                      ? tr('seasons.confirmRoster.earliestHint', 'Earliest recorded activity: {{date}}', { date: fmtDate(c.earliestActivity) })
                      : tr('seasons.confirmRoster.noActivity', 'No recorded activity')}
                  </p>
                </div>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
                  value={dates[c.playerId] ?? ''}
                  onChange={e => setDates(d => ({ ...d, [c.playerId]: e.target.value }))}
                  disabled={!selected[c.playerId]}
                  aria-label={tr('seasons.confirmRoster.rowDateLabel', 'Joined from — {{name}}', { name: c.playerName })}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
            <Button type="button" onClick={submit} isLoading={confirm.isPending} disabled={selectedIds.length === 0}>
              {tr('seasons.confirmRoster.confirmBtn', 'Confirm {{count}} entries', { count: selectedIds.length })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
