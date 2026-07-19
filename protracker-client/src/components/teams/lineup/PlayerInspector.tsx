import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AlertTriangle, ArrowUpRight, ExternalLink, HelpCircle, Minus, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import { useDynamicLabels } from '../../../i18n/dynamicLabels';
import { usePlayerObjectiveTests } from '../../../hooks/useEvidence';
import { usePlayerBenchmarks } from '../../../hooks/useBenchmarks';
import { usePlayerWellbeing } from '../../../hooks/useWellbeing';
import { usePlayerGoals } from '../../../hooks/useGoals';
import { useCoachTasks } from '../../../hooks/useTasks';
import { useInjuries } from '../../../hooks/useInjuries';
import { SourceBadge } from '../../ui/SourceBadge';
import { MissingValue } from '../../ui/MissingValue';
import { Skeleton } from '../../ui/Skeleton';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { RatingChip } from './LineupPlayerCard';
import { positionAbbr } from './lineupLayouts';
import { wellbeingRecency, topTrends } from './inspectorLogic';
import { computeStanding, type StandingBand } from '../../evidence/benchmarkStanding';
import { SCORE_TONE_HEX, scoreTone } from '../../charts/chartColors';
import type { TrendState } from '../../evidence/MetricTrendSummary';
import type { CategoryStat, RatingState } from './lineupLogic';
import type { Player } from '../../../types';

// The Player Inspector (lineup program Phase 2): a coach inspects any player
// without leaving the lineup — built ENTIRELY from real data. Every section is
// provenance-badged (Phase 0 taxonomy) or renders a typed MissingValue.
//
// Absence semantics (see inspectorLogic.ts): empty task/goal/injury lists are
// facts stated in plain text; a missing measurement (no check-in, no tests) is
// 'not-recorded'; form is 'not-tracked'; a failed request is 'load-failed'.
// There is NO fabricated fallback anywhere in this file — asserted by
// PlayerInspector.test.tsx's all-empty-dossier case.
//
// Phase 3: fitnessLevel RETURNED once the nullability migration landed — a
// value is a real coach entry (badged coach-entered), null renders the true
// "Not recorded" state. Preferred foot / secondary positions are coach-entered
// with an honest "Not set" default.

export interface InspectorProps {
  player: Player;
  rating: RatingState;
  loadFailed: boolean;
  breakdown: CategoryStat[];
  injured: boolean;
  /** Gates every query — nothing fetches until the inspector is open. */
  open: boolean;
  onOpenProfile: () => void;
  /** Phase 5: open the comparison modal seeded with this player. */
  onCompare?: () => void;
}

const TREND_META: Record<TrendState['kind'], { icon: LucideIcon; color: string; key: string; fallback: string }> = {
  improving: { icon: TrendingUp, color: SCORE_TONE_HEX.green, key: 'evidence.trendImproving', fallback: 'Improving' },
  flat: { icon: Minus, color: SCORE_TONE_HEX.amber, key: 'evidence.trendFlat', fallback: 'Flat' },
  declining: { icon: TrendingDown, color: SCORE_TONE_HEX.red, key: 'evidence.trendDeclining', fallback: 'Declining' },
  needsMore: { icon: HelpCircle, color: '#9ca3af', key: 'evidence.trendNeedsThree', fallback: 'Trend needs ≥3 tests' },
  inconsistent: { icon: HelpCircle, color: '#9ca3af', key: 'evidence.trendInconsistent', fallback: 'Too varied to call' },
};

const BAND_KEYS: Record<StandingBand, { key: string; fallback: string }> = {
  belowLow: { key: 'evidence.standingBelowLow', fallback: 'Below the Low benchmark' },
  lowToAverage: { key: 'evidence.standingLowToAverage', fallback: 'Between Low and Average' },
  averageToElite: { key: 'evidence.standingAverageToElite', fallback: 'Between Average and Elite' },
  beyondElite: { key: 'evidence.standingBeyondElite', fallback: 'Elite reached' },
};

function TrendChip({ trend }: { trend: TrendState }) {
  const { t } = useTranslation();
  const meta = TREND_META[trend.kind];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: meta.color }}>
      <Icon size={12} aria-hidden="true" /> {t(meta.key, meta.fallback)}
    </span>
  );
}

function Section({ title, badges, children }: {
  title: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <h5 className="text-xs font-bold text-gray-900 dark:text-white">{title}</h5>
        <span className="flex items-center gap-1">{badges}</span>
      </div>
      {children}
    </section>
  );
}

/** Per-query wrapper: skeleton while loading, typed load-failed on error. */
function QuerySection({ loading, error, children }: {
  loading: boolean;
  error: boolean;
  children: React.ReactNode;
}) {
  if (loading) return <Skeleton className="h-10 w-full rounded-lg" />;
  if (error) return <MissingValue reason="load-failed" />;
  return <>{children}</>;
}

export function PlayerInspectorBody({ player, rating, loadFailed, breakdown, injured, open, onOpenProfile, onCompare }: InspectorProps) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const dyn = useDynamicLabels();

  const tests = usePlayerObjectiveTests(player.id, undefined, open);
  const benchmarks = usePlayerBenchmarks(player.id, open);
  const wellbeing = usePlayerWellbeing(player.id, 30, open);
  const goals = usePlayerGoals(player.id, open);
  const tasks = useCoachTasks({ playerId: player.id, completed: false }, open);
  const injuries = useInjuries(open ? player.id : null);

  const trendRows = useMemo(() => topTrends(tests.data ?? []), [tests.data]);
  const recency = useMemo(
    () => wellbeingRecency(wellbeing.data?.checkins ?? [], new Date()),
    [wellbeing.data],
  );
  const activeInjuries = (injuries.data ?? []).filter(i => i.recoveryStatus !== 'FullyRecovered');
  const activeGoals = (goals.data ?? []).filter(g => g.status === 'Active');
  const openTasks = tasks.data ?? [];

  // Standing claims a band only when a benchmark profile is actually assigned
  // (the S5 ruling: no cohort claim without a chosen cohort).
  const hasProfile = benchmarks.data?.benchmarkProfileId != null;
  const anchorsFor = (metricId: number) => {
    const v = benchmarks.data?.values?.[metricId];
    return v ? { low: v.benchmarkLow, mid: v.benchmarkMid, high: v.benchmarkHigh } : null;
  };

  return (
    <div className="text-start">
      {/* Header — rating is CALCULATED and says so */}
      <div className="flex items-center gap-2.5">
        <PlayerAvatar name={player.fullName} imageUrl={player.profileImageUrl} sportId={player.sportId} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {player.jerseyNumber != null && <span className="text-indigo-500 me-1">#{player.jerseyNumber}</span>}
            {player.fullName}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            {positionAbbr(player.positionId, t)}
            {player.status && player.status !== 'Active' && <PlayerStatusBadge status={player.status} />}
            {injured && (
              <span className="flex items-center gap-0.5 text-red-500 font-medium">
                <AlertTriangle size={10} /> {t('teams.lineupInjured', 'Injured')}
              </span>
            )}
          </p>
        </div>
        <RatingChip rating={rating} loadFailed={loadFailed} className="text-sm px-2 py-1" />
      </div>
      <div className="mt-1.5">
        <SourceBadge source="calculated" size="xs" title={t('common.dataSource.calculatedFromEvidence', 'Calculated · from evidence scores')} />
      </div>

      {/* Category breakdown — calculated; absent categories stay "—" */}
      <div className="mt-3 space-y-1.5">
        {breakdown.map(stat => {
          const muted = stat.value == null || stat.confidence === 'Low';
          return (
            <div key={stat.category} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">
                {t(`evidence.metricCategory${stat.category}`, stat.category)}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" dir="ltr">
                {stat.value != null && (
                  <div
                    className={clsx('h-full rounded-full', muted && 'opacity-40')}
                    style={{ width: `${stat.value * 10}%`, background: muted ? '#9ca3af' : SCORE_TONE_HEX[scoreTone(stat.value)] }}
                  />
                )}
              </div>
              <span className={clsx('text-[11px] font-semibold w-7 text-end', muted ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200')}>
                {stat.value != null ? stat.value.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Coach-entered profile (Phase 3) — value or a typed honest absence */}
      <Section
        title={t('teams.inspectorCoachProfile', 'Coach-entered profile')}
        badges={<SourceBadge source="coach-entered" size="xs" />}
      >
        <dl className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500 dark:text-gray-400">{t('players.fitnessLevel', 'Fitness Level')}</dt>
            <dd className="text-gray-800 dark:text-gray-200 font-semibold">
              {player.fitnessLevel != null
                ? `${player.fitnessLevel}/10`
                : <MissingValue reason="not-recorded" variant="compact" />}
            </dd>
          </div>
          {player.sportId === 1 && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">{t('teams.inspectorPreferredFoot', 'Preferred foot')}</dt>
              <dd className="text-gray-800 dark:text-gray-200 font-semibold">
                {player.preferredFoot
                  ? t(`teams.foot${player.preferredFoot}`, player.preferredFoot)
                  : <MissingValue reason="not-set" variant="compact" />}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-500 dark:text-gray-400">{t('teams.inspectorSecondaryPositions', 'Secondary positions')}</dt>
            <dd className="text-gray-800 dark:text-gray-200 font-semibold">
              {player.secondaryPositionIds && player.secondaryPositionIds.length > 0
                ? player.secondaryPositionIds.map(id => positionAbbr(id, t)).join(', ')
                : <MissingValue reason="not-set" variant="compact" />}
            </dd>
          </div>
        </dl>
      </Section>

      {/* Measured tests — recorded values, calculated trend/standing */}
      <Section
        title={t('teams.inspectorMeasuredTests', 'Measured tests')}
        badges={<><SourceBadge source="recorded" size="xs" /><SourceBadge source="calculated" size="xs" /></>}
      >
        <QuerySection loading={tests.isLoading || benchmarks.isLoading} error={tests.isError}>
          {trendRows.length === 0 ? (
            <MissingValue reason="not-recorded" />
          ) : (
            <ul className="space-y-2">
              {trendRows.map(row => {
                const anchors = anchorsFor(row.metricDefinitionId);
                const standing = hasProfile && anchors ? computeStanding(row.latest.value, anchors) : null;
                return (
                  <li key={row.metricDefinitionId} className="text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{row.metricName}</span>
                      {row.trend && <TrendChip trend={row.trend} />}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400">
                      <span>
                        {t('teams.inspectorLatest', 'Latest')}{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-300" dir="ltr">{row.latest.value} {row.unit}</span>
                        {' · '}{t('teams.inspectorTestsCount', '{{count}} tests', { count: row.testCount })}
                      </span>
                      <span>{formatDate(row.latest.testedAt, { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {standing && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t(BAND_KEYS[standing.band].key, BAND_KEYS[standing.band].fallback)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </QuerySection>
      </Section>

      {/* Injuries — recorded; an empty list is a fact, not a missing state */}
      <Section title={t('teams.inspectorInjuries', 'Injuries')} badges={<SourceBadge source="recorded" size="xs" />}>
        <QuerySection loading={injuries.isLoading} error={injuries.isError}>
          {activeInjuries.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('teams.inspectorNoActiveInjuries', 'No active injuries')}</p>
          ) : (
            <ul className="space-y-1.5">
              {activeInjuries.map(inj => (
                <li key={inj.id} className="text-[11px]">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {inj.injuryType}
                    {inj.bodyPart ? ` · ${inj.bodyPart}` : ''}
                    <span className="ms-1.5 font-medium text-red-500">{dyn.generic('severity', inj.severity)}</span>
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {inj.expectedReturnDate
                      ? t('teams.inspectorExpectedReturn', 'Expected return · {{date}}', { date: formatDate(inj.expectedReturnDate, { month: 'short', day: 'numeric' }) })
                      : t('teams.inspectorReturnNotSet', 'Return date not set')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </QuerySection>
      </Section>

      {/* Wellbeing — player-reported, named honestly, dated; absence = not-recorded */}
      <Section title={t('teams.inspectorWellbeing', 'Wellbeing check-in')} badges={<SourceBadge source="player-reported" size="xs" />}>
        <QuerySection loading={wellbeing.isLoading} error={wellbeing.isError}>
          {recency == null ? (
            <div>
              <MissingValue reason="not-recorded" />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {t('teams.inspectorNoCheckin', 'No check-in in the last 30 days')}
              </p>
            </div>
          ) : (
            <div className="text-[11px]">
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {t('teams.inspectorSelfReported', 'Self-reported · {{date}}', { date: formatDate(recency.checkin.date, { month: 'short', day: 'numeric' }) })}
              </p>
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                <span>{t('wellbeing.energy', 'Energy')} <b>{recency.checkin.energy}/5</b></span>
                <span>{t('wellbeing.feeling', 'Feeling')} <b>{recency.checkin.feeling}/5</b></span>
                <span>{t('wellbeing.sleep', 'Sleep')} <b>{recency.checkin.sleep}/5</b></span>
              </div>
              {recency.checkin.hasPain && (
                <p className="mt-1 flex items-center gap-1 text-red-500 font-medium">
                  <AlertTriangle size={11} /> {t('teams.inspectorPain', 'Pain reported')}
                  {recency.checkin.painArea ? ` · ${recency.checkin.painArea}` : ''}
                </p>
              )}
            </div>
          )}
        </QuerySection>
      </Section>

      {/* Goals — shared (non-private) only; empty list is a fact */}
      <Section title={t('teams.inspectorGoals', 'Goals')} badges={
        <span className="text-[10px] text-gray-400">{t('teams.inspectorGoalsCaption', 'Shared goals only')}</span>
      }>
        <QuerySection loading={goals.isLoading} error={goals.isError}>
          {activeGoals.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('teams.inspectorNoGoals', 'No shared goals')}</p>
          ) : (
            <ul className="space-y-1.5">
              {activeGoals.slice(0, 3).map(g => (
                <li key={g.id} className="text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{g.title}</span>
                    {g.progressPercent != null && (
                      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{Math.round(g.progressPercent)}%</span>
                    )}
                  </div>
                  {g.progressPercent != null && (
                    <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mt-0.5" dir="ltr">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, g.progressPercent))}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QuerySection>
      </Section>

      {/* Open tasks — coach-entered; empty list is a fact */}
      <Section title={t('teams.inspectorTasks', 'Open tasks')} badges={<SourceBadge source="coach-entered" size="xs" />}>
        <QuerySection loading={tasks.isLoading} error={tasks.isError}>
          {openTasks.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('teams.inspectorNoTasks', 'No open tasks')}</p>
          ) : (
            <ul className="space-y-1">
              {openTasks.slice(0, 3).map(task => (
                <li key={task.id} className="text-[11px] flex items-center justify-between gap-2">
                  <span className="text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                  {task.dueDate && (
                    <span className="text-gray-400 flex-shrink-0">{formatDate(task.dueDate, { month: 'short', day: 'numeric' })}</span>
                  )}
                </li>
              ))}
              {openTasks.length > 3 && (
                <li className="text-[11px] text-gray-400">+{openTasks.length - 3}</li>
              )}
            </ul>
          )}
        </QuerySection>
      </Section>

      {/* Form — the app does not measure this. Explicitly. */}
      <Section title={t('teams.inspectorFormLabel', 'Form')}>
        <MissingValue reason="not-tracked" />
      </Section>

      <button
        type="button"
        onClick={onOpenProfile}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
      >
        <ExternalLink size={12} /> {t('teams.inspectorOpenProfile', 'Open full profile')}
        <ArrowUpRight size={12} className="opacity-70" />
      </button>
      {onCompare && (
        <button
          type="button"
          onClick={onCompare}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          {t('teams.inspectorCompare', 'Compare with a teammate')}
        </button>
      )}
    </div>
  );
}

/** Desktop inline panel: labeled region, focus moves in on open, Esc handled by the caller. */
export function PlayerInspectorPanel({ onClose, ...body }: InspectorProps & { onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [body.player.id]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="complementary"
      aria-label={body.player.fullName}
      className="w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-14 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <div className="flex justify-end -mt-1 -me-1">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('teams.inspectorClose', 'Close inspector')}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <PlayerInspectorBody {...body} />
    </aside>
  );
}
