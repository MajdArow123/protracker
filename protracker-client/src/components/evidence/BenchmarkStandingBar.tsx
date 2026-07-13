import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { computeStanding, type BenchmarkAnchors } from './benchmarkStanding';
import { scoreTone, SCORE_TONE_HEX } from '../charts/chartColors';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useAuth } from '../../context/AuthContext';

interface Props {
  /** Latest raw test value. */
  value: number;
  unit: string;
  testedAt: string;
  anchors: BenchmarkAnchors;
  /** null = no benchmark profile assigned (anchors are app defaults). */
  profileName: string | null;
}

// Where the latest measured value stands on the CURRENT benchmark anchors:
// a neutral-gray positional scale (Low/Average/Elite ticks — same semantics as
// the chart's anchor lines, never score-band colors) with one athlete marker.
// Marker position, band text and tone all come from computeStanding, so they
// cannot disagree. With no profile assigned we show the geometry + raw gap
// against the app defaults but SUPPRESS the band-placement sentence — claiming
// "between Average and Elite" implies a cohort nobody chose.
export function BenchmarkStandingBar({ value, unit, testedAt, anchors, profileName }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const { user } = useAuth();
  const standing = computeStanding(value, anchors);
  // Degenerate anchors (e.g. capped percentages where Average === Elite):
  // no honest claim exists, so render nothing rather than something wrong.
  if (!standing) return null;

  const markerColor = SCORE_TONE_HEX[scoreTone(standing.score)];
  const isCoach = user?.role === 'Coach' || user?.role === 'Admin';

  const ANCHOR_LABELS = {
    low: t('evidence.lowLabel', 'Low'),
    average: t('evidence.averageLabel', 'Average'),
    elite: t('evidence.eliteLabel', 'Elite'),
  } as const;

  const BAND_TEXT = {
    belowLow: t('evidence.standingBelowLow', 'Below the Low benchmark'),
    lowToAverage: t('evidence.standingLowToAverage', 'Between Low and Average'),
    averageToElite: t('evidence.standingAverageToElite', 'Between Average and Elite'),
    beyondElite: t('evidence.standingBeyondElite', 'Elite reached'),
  } as const;

  const ticks: { pos: number; label: string; value: number }[] = [
    { pos: 0.3, label: ANCHOR_LABELS.low, value: anchors.low },
    { pos: 0.5, label: ANCHOR_LABELS.average, value: anchors.mid },
    { pos: 1.0, label: ANCHOR_LABELS.elite, value: anchors.high },
  ];

  const gapText = standing.gapToNext
    ? t('evidence.standingGap', '{{gap}} {{unit}} to {{anchor}}', {
        gap: formatNumber(standing.gapToNext.amount),
        unit,
        anchor: ANCHOR_LABELS[standing.gapToNext.target],
      })
    : null;
  const asOf = t('evidence.standingAsOf', 'as of {{date}}', {
    date: formatDate(testedAt, { month: 'short', day: 'numeric' }),
  });

  return (
    <div className="mb-4">
      {/* Positional scale — stays LTR like the chart above it (dir on purpose). */}
      <div dir="ltr" className="relative h-9 mx-1">
        <div className="absolute top-2 left-0 right-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        {ticks.map(tick => (
          <div key={tick.label} className="absolute top-0" style={{ left: `${tick.pos * 100}%` }}>
            <div className="w-px h-5 bg-gray-400 dark:bg-gray-500 -translate-x-1/2" />
            <p
              className={`absolute top-5 text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap ${
                tick.pos === 1 ? 'right-0' : '-translate-x-1/2'
              }`}
            >
              {tick.label} {formatNumber(tick.value)}
            </p>
          </div>
        ))}
        <div
          className="absolute top-[5px] w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 shadow -translate-x-1/2"
          style={{ left: `${standing.position * 100}%`, background: markerColor }}
          title={`${formatNumber(value)} ${unit}`.trim()}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        {profileName ? (
          <>
            <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              {standing.band === 'beyondElite' && <CheckCircle2 size={12} className="text-green-500" />}
              {BAND_TEXT[standing.band]}
            </span>
            {gapText && <span className="text-gray-500 dark:text-gray-400">{gapText}</span>}
          </>
        ) : (
          // No profile: geometry + raw gap only — no band claim.
          gapText && <span className="text-gray-500 dark:text-gray-400">{gapText}</span>
        )}
        <span className="text-gray-400 dark:text-gray-500">{asOf}</span>
        {profileName ? (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-semibold">
            {profileName}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold">
            {t('evidence.defaultBenchmarksChip', 'App default benchmarks — no profile assigned')}
          </span>
        )}
      </div>
      {!profileName && isCoach && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {t('evidence.assignProfileHint', "Assign a benchmark profile from the team's Evidence tab to compare against the right level.")}
        </p>
      )}
    </div>
  );
}
