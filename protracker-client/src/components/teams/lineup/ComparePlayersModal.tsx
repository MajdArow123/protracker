import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { evidenceApi } from '../../../api/evidenceApi';
import { matchesApi } from '../../../api/matchesApi';
import { Modal } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';
import { SourceBadge } from '../../ui/SourceBadge';
import { MissingValue } from '../../ui/MissingValue';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { RatingChip } from './LineupPlayerCard';
import { FitChip } from './FitChip';
import { positionAbbr } from './lineupLayouts';
import { scoreTone, SCORE_TONE_HEX } from '../../charts/chartColors';
import { confidenceLabel } from '../../evidence/evidenceUtils';
import { categoryBreakdown, type LineupPlayer } from './lineupLogic';
import { assessFit, type FitCategory } from './lineupFitLogic';
import { recommendForSlot, coAppearanceCount, PICK_DETAIL_EN } from './lineupAnalysisLogic';
import { topTrends } from './inspectorLogic';
import type { FormationSlot } from './lineupFormations';
import type { EvidenceBasedScore, Player } from '../../../types';

// Player comparison (Phase 5): 2-4 players over REAL attributes only — the
// evidence rating (RatingChip verbatim), category means (StatPopover muting
// rules), availability, coach-entered profile facts, measured tests
// (computeTrend gates via topTrends), and the pairwise co-appearance COUNT
// (never a chemistry score). With a target slot, the "suggested" pick is the
// unchanged engine ordering (recommendForSlot) — labeled calculated, framed
// as a suggestion, never "optimal"; no eligible candidate → an honest
// no-suggestion line. Every absent value is a typed MissingValue, never a
// fabricated fallback.

const MAX_COMPARE = 4;

const FIT_LABEL: Record<FitCategory, { key: string; fallback: string }> = {
  natural: { key: 'teams.fitNatural', fallback: 'Natural position' },
  secondary: { key: 'teams.fitSecondary', fallback: 'Secondary position (coach-entered)' },
  outOfPosition: { key: 'teams.lineupOutOfPosition', fallback: 'Out of position' },
  cantAssess: { key: 'teams.fitCantAssess', fallback: "Can't assess — no position set" },
};

const TREND_KEY: Record<string, { key: string; fallback: string }> = {
  improving: { key: 'evidence.trendImproving', fallback: 'Improving' },
  flat: { key: 'evidence.trendFlat', fallback: 'Flat' },
  declining: { key: 'evidence.trendDeclining', fallback: 'Declining' },
  needsMore: { key: 'evidence.trendNeedsThree', fallback: 'Trend needs ≥3 tests' },
  inconsistent: { key: 'evidence.trendInconsistent', fallback: 'Too varied to call' },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Seed columns (deduped, capped at 4). */
  initialIds: number[];
  /** Comparison context: recommendation + fit rows render only with a slot. */
  targetSlot: FormationSlot | null;
  players: Player[];
  lineupById: Map<number, LineupPlayer>;
  scoresById: Map<number, EvidenceBasedScore[]>;
  failedIds: Set<number>;
  injuredIds: Set<number>;
  sportId: number;
}

export function ComparePlayersModal({
  isOpen, onClose, initialIds, targetSlot, players, lineupById, scoresById, failedIds, injuredIds, sportId,
}: Props) {
  const { t } = useTranslation();
  const [ids, setIds] = useState<number[]>(() => [...new Set(initialIds)].slice(0, MAX_COMPARE));

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const nameOf = (id?: number | null) => (id != null ? playerById.get(id)?.fullName ?? '' : '');
  const columns = ids.map(id => playerById.get(id)).filter((p): p is Player => p != null);

  // Lazy per-column fetches — same query keys as the existing hooks, so the
  // inspector/board caches are shared. Nothing fetches until the modal opens.
  const testQueries = useQueries({
    queries: ids.map(id => ({
      queryKey: ['evidence', 'tests', id, 'all'],
      queryFn: () => evidenceApi.getObjectiveTests(id),
      enabled: isOpen,
    })),
  });
  const ratingQueries = useQueries({
    queries: ids.map(id => ({
      queryKey: ['matches', 'player', id],
      queryFn: () => matchesApi.getPlayerRatings(id),
      enabled: isOpen,
    })),
  });

  const recommendation = targetSlot
    ? recommendForSlot(ids.map(id => lineupById.get(id)).filter((p): p is LineupPlayer => p != null), targetSlot)
    : null;

  const detailSentence = (): string | null => {
    if (!recommendation) return null;
    if (recommendation.onlyEligible) {
      return t('teams.compareOnlyEligible', 'Only eligible player among those compared');
    }
    const d = recommendation.detail;
    if (!d) return null;
    const name = nameOf(recommendation.runnerUpId);
    const conf = (c: string) => confidenceLabel(c as never, t);
    switch (d.kind) {
      case 'higherValue':
        return t('teams.whyHigherValue', PICK_DETAIL_EN.higherValue, { name, a: d.a.toFixed(1), b: d.b.toFixed(1) });
      case 'confidenceTiebreak':
        return t('teams.whyConfidenceTiebreak', PICK_DETAIL_EN.confidenceTiebreak, { name, value: d.value.toFixed(1), a: conf(d.a), b: conf(d.b) });
      case 'coverageTiebreak':
        return t('teams.whyCoverageTiebreak', PICK_DETAIL_EN.coverageTiebreak, { name, a: d.a, b: d.b });
      case 'runnerUpNoEvidence':
        return t('teams.whyRunnerUpNoEvidence', PICK_DETAIL_EN.runnerUpNoEvidence, { name });
      case 'alphabetical':
        return t('teams.whyAlphabetical', PICK_DETAIL_EN.alphabetical, { name });
    }
  };

  const addable = players.filter(p => !ids.includes(p.id));

  const pairs = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
    }
    return out;
  }, [ids]);

  const labelRow = (label: string) => (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-2.5 mb-0.5">{label}</p>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('teams.compareTitle', 'Compare players')} size="xl">
      {targetSlot && (
        <div className="mb-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold">
              {recommendation
                ? t('teams.compareSuggested', 'Suggested for {{slot}}: {{name}}', { slot: targetSlot.key, name: nameOf(recommendation.playerId) })
                : t('teams.compareNoneEligible', 'None of the compared players lists {{slot}} as a natural position — no suggestion', { slot: targetSlot.key })}
            </span>
            <SourceBadge
              source="calculated"
              size="xs"
              title={t('teams.whyMethod', 'Calculated · evidence value first; confidence only breaks exact ties')}
            />
          </div>
          {recommendation && detailSentence() && (
            <p className="mt-0.5">{detailSentence()}</p>
          )}
          <p className="mt-0.5 text-[11px] text-indigo-400 dark:text-indigo-500">
            {t('teams.whyCaption', 'A suggestion computed from evidence ratings and positions — the call is yours.')}
          </p>
        </div>
      )}

      {ids.length < 2 && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {t('teams.comparePickTwo', 'Pick at least two players to compare')}
        </p>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(150px, 1fr))` }}>
          {columns.map((p, i) => {
            const lp = lineupById.get(p.id);
            const rating = lp?.rating ?? { kind: 'none' as const };
            const breakdown = categoryBreakdown(scoresById.get(p.id) ?? []);
            const fit = targetSlot ? assessFit(targetSlot, p) : null;
            const tests = testQueries[i];
            const trendRows = tests?.data ? topTrends(tests.data, 2) : [];
            return (
              <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <PlayerAvatar name={p.fullName} imageUrl={p.profileImageUrl} sportId={p.sportId} size={36} />
                  <button
                    type="button"
                    onClick={() => setIds(prev => prev.filter(x => x !== p.id))}
                    aria-label={t('teams.compareRemove', 'Remove {{name}}', { name: p.fullName })}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="mt-1.5 text-sm font-bold text-gray-900 dark:text-white truncate">
                  {p.jerseyNumber != null && <span className="text-indigo-500 me-1">#{p.jerseyNumber}</span>}
                  {p.fullName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                  {positionAbbr(p.positionId, t)}
                  {p.status && p.status !== 'Active' && <PlayerStatusBadge status={p.status} />}
                  {injuredIds.has(p.id) && (
                    <span className="flex items-center gap-0.5 text-red-500 font-medium">
                      <AlertTriangle size={10} /> {t('teams.lineupInjured', 'Injured')}
                    </span>
                  )}
                </p>

                <div className="mt-1.5">
                  <RatingChip rating={rating} loadFailed={failedIds.has(p.id)} />
                </div>

                {fit && (
                  <>
                    {labelRow(t('teams.compareFitLabel', 'Fit for {{slot}}', { slot: targetSlot!.key }))}
                    <p className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                      <FitChip fit={fit} /> {t(FIT_LABEL[fit.category].key, FIT_LABEL[fit.category].fallback)}
                    </p>
                  </>
                )}

                {labelRow(t('teams.compareCategories', 'Category means'))}
                <div className="space-y-1">
                  {breakdown.map(stat => {
                    const muted = stat.value == null || stat.confidence === 'Low';
                    return (
                      <div key={stat.category} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 flex-shrink-0 truncate">
                          {t(`evidence.metricCategory${stat.category}`, stat.category)}
                        </span>
                        <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" dir="ltr">
                          {stat.value != null && (
                            <div
                              className={clsx('h-full rounded-full', muted && 'opacity-40')}
                              style={{ width: `${stat.value * 10}%`, background: muted ? '#9ca3af' : SCORE_TONE_HEX[scoreTone(stat.value)] }}
                            />
                          )}
                        </div>
                        <span className={clsx('text-[10px] font-semibold w-6 text-end', muted ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200')}>
                          {stat.value != null ? stat.value.toFixed(1) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {labelRow(t('teams.compareCoachEntered', 'Coach-entered'))}
                <div className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                  {sportId === 1 && (
                    <p className="flex items-center gap-1.5">
                      <span className="text-gray-400">{t('teams.inspectorPreferredFoot', 'Preferred foot')}:</span>
                      {p.preferredFoot
                        ? t(`teams.foot${p.preferredFoot}`, p.preferredFoot)
                        : <MissingValue reason="not-set" variant="compact" />}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5">
                    <span className="text-gray-400">{t('teams.inspectorSecondaryPositions', 'Secondary positions')}:</span>
                    {(p.secondaryPositionIds ?? []).length > 0
                      ? (p.secondaryPositionIds ?? []).map(id => positionAbbr(id, t)).join(', ')
                      : <MissingValue reason="not-set" variant="compact" />}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-gray-400">{t('players.fitnessLevel', 'Fitness Level')}:</span>
                    {p.fitnessLevel != null
                      ? `${p.fitnessLevel}/10`
                      : <MissingValue reason="not-recorded" variant="compact" />}
                  </p>
                </div>

                {labelRow(t('teams.compareTests', 'Measured tests'))}
                {tests?.isLoading ? (
                  <Skeleton className="h-8 w-full rounded-lg" />
                ) : tests?.isError ? (
                  <MissingValue reason="load-failed" variant="compact" />
                ) : trendRows.length === 0 ? (
                  <MissingValue reason="not-recorded" variant="compact" />
                ) : (
                  <div className="space-y-1">
                    {trendRows.map(row => (
                      <div key={row.metricDefinitionId} className="text-[11px]">
                        <p className="text-gray-600 dark:text-gray-300 truncate font-medium">{row.metricName}</p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {row.latest.value} {row.latest.unit}
                          {' · '}
                          {row.trend
                            ? t(TREND_KEY[row.trend.kind].key, TREND_KEY[row.trend.kind].fallback)
                            : t('teams.compareSingleTest', 'single test')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Plus size={13} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
        <select
          value=""
          disabled={ids.length >= MAX_COMPARE || addable.length === 0}
          onChange={e => {
            const id = Number(e.target.value);
            if (id) setIds(prev => (prev.length < MAX_COMPARE && !prev.includes(id) ? [...prev, id] : prev));
          }}
          aria-label={t('teams.compareAdd', 'Add player to comparison')}
          className="flex-1 max-w-xs px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">
            {ids.length >= MAX_COMPARE
              ? t('teams.compareMax', 'Maximum {{count}} players', { count: MAX_COMPARE })
              : t('teams.compareAdd', 'Add player to comparison')}
          </option>
          {ids.length < MAX_COMPARE && addable.map(p => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
      </div>

      {pairs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
            {t('teams.compareCoAppearance', 'Shared appearances')}
          </p>
          <ul className="space-y-0.5">
            {pairs.map(([a, b]) => {
              const qa = ratingQueries[ids.indexOf(a)];
              const qb = ratingQueries[ids.indexOf(b)];
              return (
                <li key={`${a}-${b}`} className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="font-medium text-gray-600 dark:text-gray-300">{nameOf(a)} · {nameOf(b)}</span>
                  {qa?.isLoading || qb?.isLoading ? (
                    <Skeleton className="h-3 w-16 rounded" />
                  ) : qa?.isError || qb?.isError ? (
                    <MissingValue reason="load-failed" variant="compact" />
                  ) : (
                    t('teams.compareCoAppearanceCount', 'rated in the same logged match {{count}} times', {
                      count: coAppearanceCount(qa?.data ?? [], qb?.data ?? []),
                    })
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[10px] text-gray-400">
            {t('teams.compareCoAppearanceNote', 'A shared-appearance count from match ratings — not a chemistry measure.')}
          </p>
        </div>
      )}
    </Modal>
  );
}
