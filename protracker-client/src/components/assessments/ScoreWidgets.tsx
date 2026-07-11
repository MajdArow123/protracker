import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { ScoreRing } from '../charts/ScoreRing';
import { scoreTone, SCORE_TONE_HEX } from '../charts/chartColors';

// Shared between the coach AssessmentPage and the solo self-assessment page so the
// slider/ring UX stays identical for both flows.

export function scoreColor(score: number) {
  return SCORE_TONE_HEX[scoreTone(score)];
}

const SCORE_LABELS = {
  green: { text: 'Good', key: 'scoreGood', cls: 'text-green-500 bg-green-500/10' },
  amber: { text: 'Fair', key: 'scoreFair', cls: 'text-amber-500 bg-amber-500/10' },
  red: { text: 'Low', key: 'scoreLow', cls: 'text-red-500 bg-red-500/10' },
} as const;

export function scoreLabel(score: number) {
  return SCORE_LABELS[scoreTone(score)];
}

interface ScoreSliderProps {
  name: string;
  description?: string;
  value: number | null;
  onChange: (v: number) => void;
  required?: boolean;
  /** Extra content rendered inside the card below the slider (e.g. the evidence panel). */
  footer?: React.ReactNode;
}

export function ScoreSlider({ name, description, value, onChange, required, footer }: ScoreSliderProps) {
  const { t } = useTranslation();
  const isSet = value !== null;
  const display = value ?? 5.5;
  const color = isSet ? scoreColor(display) : '#9ca3af';
  const label = isSet ? scoreLabel(display) : null;

  return (
    <div className={clsx('rounded-2xl border bg-white dark:bg-gray-900 p-4',
      required && !isSet ? 'border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-200 dark:border-gray-800')}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            {name}
            {required && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{t('common.required', 'Required')}</span>}
          </p>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {label ? (
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold', label.cls)}>{t(`assessment.${label.key}`, label.text)}</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800">{t('assessment.notScored', 'Not scored')}</span>
          )}
          <span className="text-xl font-black" style={{ color }}>{isSet ? display : '—'}</span>
          <span className="text-xs text-gray-400">/10</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={display}
        onChange={e => onChange(Number(e.target.value))}
        className="score-slider"
        style={{ '--thumb-color': color } as React.CSSProperties}
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
        <span>1 — {t('assessment.poor', 'Poor')}</span>
        <span>10 — {t('assessment.excellent', 'Excellent')}</span>
      </div>
      {footer}
    </div>
  );
}

export function OverallScoreRing({ scores, total }: { scores: Record<number, number | null>; total: number }) {
  const { t } = useTranslation();
  const vals = Object.values(scores).filter((v): v is number => v !== null);
  const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <ScoreRing
        value={avg}
        display={vals.length > 0 ? avg.toFixed(1) : '—'}
        sublabel={t('assessment.avg', 'avg')}
      />
      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2">{t('assessment.overallScore', 'Overall Score')}</p>
      <p className="text-xs text-gray-500">{vals.length}/{total} {t('assessment.scored', 'scored')}</p>
    </div>
  );
}
