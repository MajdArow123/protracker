import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronDown, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { SkeletonChart } from '../ui/Skeleton';
import { useTeamEvidencePerformance } from '../../hooks/useEvidence';
import { scoreTone, SCORE_TONE_HEX } from '../charts/chartColors';
import { coverageLevel } from './teamCoverage';
import type { TeamMetricPerformance, TeamMetricOutlier } from '../../types';

interface Props {
  teamId: number;
}

// Proportional score-band composition (red/amber/green shares of the scored
// players). A composition bar has no positional meaning, so unlike the S5
// standing scale it may mirror naturally in RTL.
function BandBar({ bands }: { bands: TeamMetricPerformance['bandCounts'] }) {
  const total = bands.red + bands.amber + bands.green;
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-1 min-w-[80px]">
      {(['red', 'amber', 'green'] as const).map(tone =>
        bands[tone] > 0 ? (
          <div key={tone} style={{ width: `${(bands[tone] / total) * 100}%`, background: SCORE_TONE_HEX[tone] }} />
        ) : null,
      )}
    </div>
  );
}

function OutlierChips({ label, players, tone, onOpen }: {
  label: string;
  players: TeamMetricOutlier[];
  tone: 'red' | 'green';
  onOpen: (playerId: number) => void;
}) {
  if (players.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-gray-400 dark:text-gray-500">{label}:</span>
      {players.map(p => (
        <button
          key={p.playerId}
          type="button"
          onClick={() => onOpen(p.playerId)}
          className={clsx(
            'px-2 py-0.5 rounded-full font-semibold transition-colors cursor-pointer',
            tone === 'red'
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              : 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20',
          )}
        >
          {p.playerName} {p.score.toFixed(1)}
        </button>
      ))}
    </span>
  );
}

// "Where is my squad strong or weak, and who needs attention" — per-metric
// rollup of the blended evidence scores, every stat carrying its coverage
// denominator (coverageLevel gates how confidently the average renders).
export function SquadPerformanceCard({ teamId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useTeamEvidencePerformance(teamId);
  const [expanded, setExpanded] = useState<number | null>(null);

  const header = (
    <span className="flex items-center gap-2">
      <BarChart3 size={15} className="text-indigo-500" />
      {t('evidence.squadPerformanceTitle', 'Squad Performance')}
    </span>
  );

  const grouped = useMemo(() => {
    if (!data) return [];
    const scored = data.metrics.filter(m => m.scoredCount > 0);
    const byCategory = new Map<string, TeamMetricPerformance[]>();
    for (const m of scored) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }
    // Weakest average first within each category — that's the "where are we
    // weak" reading order.
    return [...byCategory.entries()].map(([category, metrics]) => ({
      category,
      metrics: [...metrics].sort((a, b) => (a.average ?? 11) - (b.average ?? 11)),
    }));
  }, [data]);

  // FINDING-009 discipline: skeleton while loading, retry affordance on error —
  // never a silently empty rollup.
  if (isLoading) return <Card header={header}><SkeletonChart height={160} /></Card>;
  if (isError) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-between gap-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          {t('evidence.squadPerfLoadError', "Couldn't load squad performance")}
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> {t('common.retry', 'Retry')}
          </button>
        </div>
      </Card>
    );
  }
  if (!data) return null;

  const noData = data.metrics.filter(m => m.scoredCount === 0);
  const openPlayer = (playerId: number) => navigate(`/players/${playerId}?tab=evidence`);

  return (
    <Card header={header}>
      {/* Which standard the scores were normalized against — no cohort claim
          when no profile is assigned, consistent with the S5 standing bar. */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {data.profileName
          ? t('evidence.squadPerfVsProfile', 'Blended evidence scores · calibrated vs {{profile}}', { profile: data.profileName })
          : t('evidence.squadPerfDefaultAnchors', 'Blended evidence scores · app default benchmarks (no profile assigned)')}
      </p>

      {grouped.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
          {t('evidence.squadPerfEmpty', 'No evidence scores yet — run an assessment or a test day to populate the rollup.')}
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.category}>
              <h4 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                {t(`evidence.metricCategory${group.category}`, group.category)}
              </h4>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {group.metrics.map(m => {
                  const level = coverageLevel(m.scoredCount, data.squadSize);
                  const thin = level === 'thin';
                  const isOpen = expanded === m.metricDefinitionId;
                  return (
                    <div key={m.metricDefinitionId} className="py-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : m.metricDefinitionId)}
                        className="w-full flex items-center gap-3 text-start cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 w-32 truncate flex-shrink-0">
                          {m.name}
                        </span>
                        <BandBar bands={m.bandCounts} />
                        {/* The average renders only as confidently as its coverage allows. */}
                        <span
                          className={clsx('text-sm font-black tabular-nums w-9 text-end flex-shrink-0', thin && 'opacity-60')}
                          style={{ color: thin ? undefined : m.average != null ? SCORE_TONE_HEX[scoreTone(m.average)] : undefined }}
                        >
                          {m.average != null ? m.average.toFixed(1) : '—'}
                        </span>
                        <span
                          className={clsx(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                            thin
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                          )}
                        >
                          {thin
                            ? t('evidence.squadPerfThin', 'Thin data · {{scored}}/{{squad}}', { scored: m.scoredCount, squad: data.squadSize })
                            : t('evidence.squadPerfScored', '{{scored}}/{{squad}} scored', { scored: m.scoredCount, squad: data.squadSize })}
                        </span>
                        {m.belowAverageCount > 0 && (
                          <span
                            className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 flex-shrink-0"
                            title={t('evidence.squadPerfBelowAvgHint', 'Blended score under 5 on the 0-10 scale — the app average, not a cohort benchmark.')}
                          >
                            {t('evidence.squadPerfBelowAvg', '{{count}} below avg', { count: m.belowAverageCount })}
                          </span>
                        )}
                        <ChevronDown size={14} className={clsx('text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                      </button>

                      {isOpen && (
                        <div className="mt-2 ps-1 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                            <span>{t('evidence.squadPerfMin', 'Min')} <b>{m.min?.toFixed(1)}</b></span>
                            <span>{t('evidence.squadPerfMax', 'Max')} <b>{m.max?.toFixed(1)}</b></span>
                            {m.stdDev != null && (
                              <span>{t('evidence.squadPerfStdDev', 'Std dev')} <b>{m.stdDev.toFixed(2)}</b></span>
                            )}
                            <span className="text-gray-400 dark:text-gray-500">
                              {t('evidence.squadPerfVerified', '{{count}} verified', { count: m.verifiedCount })}
                            </span>
                          </p>
                          <OutlierChips
                            label={t('evidence.squadPerfNeedsAttention', 'Needs attention')}
                            players={m.lowOutliers}
                            tone="red"
                            onOpen={openPlayer}
                          />
                          <OutlierChips
                            label={t('evidence.squadPerfStandouts', 'Standouts')}
                            players={m.highOutliers}
                            tone="green"
                            onOpen={openPlayer}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {noData.length > 0 && grouped.length > 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {t('evidence.squadPerfNoDataYet', 'No data yet: {{metrics}}', { metrics: noData.map(m => m.name).join(' · ') })}
        </p>
      )}
    </Card>
  );
}
