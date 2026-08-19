import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleDashed, History } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../../context/useToast';
import { seasonsApi } from '../../api/seasonsApi';
import type { SeasonBackfillPreview, SeasonBackfillResult } from '../../types';

// Phase 10 S7. Honesty contract (ruling): the "will stay unassigned" numbers render
// with the SAME prominence as the "will be assigned" numbers — a gap or an ambiguous
// overlap is a first-class answer, never an error footnote. Nothing is written until
// the explicit confirm; the preview is a genuine dry run.
export function SeasonBackfillModal({ onClose }: { onClose: () => void }) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SeasonBackfillResult | null>(null);

  // POST-as-read: the preview endpoint computes but never writes.
  const preview = useQuery({
    queryKey: ['seasonBackfillPreview'],
    queryFn: seasonsApi.backfillPreview,
    staleTime: 0,
    gcTime: 0,
  });

  const execute = useMutation({
    mutationFn: seasonsApi.backfillExecute,
    onSuccess: data => {
      setResult(data);
      // A mass stamp touches matches, reports, dashboards… — invalidate broadly, this
      // is a rare one-shot operation.
      queryClient.invalidateQueries();
    },
    onError: () => addToast(tr('seasons.backfill.errExecute', 'Could not run the backfill.'), 'error'),
  });

  function entityLabel(type: string): string {
    switch (type) {
      case 'matchResults': return tr('seasons.backfill.entMatches', 'Matches');
      case 'playerAssessments': return tr('seasons.backfill.entAssessments', 'Assessments');
      case 'objectiveTests': return tr('seasons.backfill.entTests', 'Objective tests');
      case 'matchPerformances': return tr('seasons.backfill.entPerformances', 'Match performances');
      case 'improvementPlans': return tr('seasons.backfill.entImprovementPlans', 'Improvement plans');
      case 'lineups': return tr('seasons.backfill.entLineups', 'Match lineups');
      case 'trainingSessions': return tr('seasons.backfill.entTrainingSessions', 'Training sessions');
      case 'scheduledSessions': return tr('seasons.backfill.entScheduledSessions', 'Scheduled sessions');
      case 'trainingPlans': return tr('seasons.backfill.entTrainingPlans', 'Legacy training plans');
      default: return type;
    }
  }

  function CountsTable({ data, done }: { data: SeasonBackfillPreview; done: boolean }) {
    const rows = data.entities.filter(e => e.totalCandidates > 0);
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(e => (
            <div key={e.entityType} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-800 dark:text-gray-200">{entityLabel(e.entityType)}</span>
              <span className="flex items-center gap-3 flex-wrap justify-end">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                  <CheckCircle2 size={14} /> {e.stamped}
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                  <CircleDashed size={14} /> {e.gap + e.ambiguous}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Equal-prominence summary: assigned and unassigned side by side. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{data.totalStamped}</p>
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mt-0.5">
              {done
                ? tr('seasons.backfill.assigned', 'Assigned to a season')
                : tr('seasons.backfill.willAssign', 'Will be assigned to a season')}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{data.totalGap + data.totalAmbiguous}</p>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mt-0.5">
              {done
                ? tr('seasons.backfill.remained', 'Stayed unassigned')
                : tr('seasons.backfill.willRemain', 'Will stay unassigned')}
            </p>
          </div>
        </div>

        {data.totalStamped > 0 && (
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {tr('seasons.backfill.bySeason', 'By season:')}{' '}
            {Object.entries(
              data.entities.flatMap(e => e.bySeason).reduce<Record<string, number>>((acc, s) => {
                acc[s.seasonName] = (acc[s.seasonName] ?? 0) + s.count;
                return acc;
              }, {}),
            ).map(([name, count]) => `${name} · ${count}`).join(', ')}
          </p>
        )}
        {data.totalGap > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {tr('seasons.backfill.gapHint', '{{count}} records fall on dates no season (or roster stint) covers. Extend a season or add roster history, then run backfill again — they are never assigned by guesswork.', { count: data.totalGap })}
          </p>
        )}
        {data.totalAmbiguous > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {tr('seasons.backfill.ambiguousHint', '{{count}} records fall on dates covered by more than one season (overlapping seasons are allowed). They stay unassigned rather than picking one for you.', { count: data.totalAmbiguous })}
          </p>
        )}
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={tr('seasons.backfill.title', 'Backfill historical records')}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
            <History size={16} /> {tr('seasons.backfill.done', 'Backfill complete')}
          </div>
          <CountsTable data={result} done />
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>{tr('common.close', 'Close')}</Button>
          </div>
        </div>
      ) : preview.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : preview.isError ? (
        // A load failure is never a "nothing to backfill" claim.
        <ErrorState onRetry={() => preview.refetch()} />
      ) : preview.data!.totalCandidates === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tr('seasons.backfill.nothing', 'Nothing to backfill — there are no unassigned records in your account.')}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>{tr('common.close', 'Close')}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {tr('seasons.backfill.intro', 'Records created before seasons existed are unassigned. This assigns them by their date, using your seasons and roster history. Nothing is written until you confirm below.')}
          </p>
          <CountsTable data={preview.data!} done={false} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
            <Button
              type="button"
              onClick={() => execute.mutate()}
              isLoading={execute.isPending}
              disabled={preview.data!.totalStamped === 0}
            >
              {tr('seasons.backfill.confirm', 'Assign {{count}} records', { count: preview.data!.totalStamped })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
