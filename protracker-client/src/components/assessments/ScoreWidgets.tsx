import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

// Shared between the coach AssessmentPage and the solo self-assessment page so the
// slider/ring UX stays identical for both flows.

export function scoreColor(score: number) {
  if (score > 7) return '#10b981';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export function scoreLabel(score: number) {
  if (score > 7) return { text: 'Good', key: 'scoreGood', cls: 'text-green-500 bg-green-500/10' };
  if (score >= 5) return { text: 'Fair', key: 'scoreFair', cls: 'text-amber-500 bg-amber-500/10' };
  return { text: 'Low', key: 'scoreLow', cls: 'text-red-500 bg-red-500/10' };
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
  const color = vals.length > 0 ? scoreColor(avg) : '#9ca3af';
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = (avg / 10) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
          <circle
            cx="48" cy="48" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={circumference / 4}
            style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{vals.length > 0 ? avg.toFixed(1) : '—'}</span>
          <span className="text-[10px] text-gray-400">{t('assessment.avg', 'avg')}</span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2">{t('assessment.overallScore', 'Overall Score')}</p>
      <p className="text-xs text-gray-500">{vals.length}/{total} {t('assessment.scored', 'scored')}</p>
    </div>
  );
}
