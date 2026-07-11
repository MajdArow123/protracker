import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { EvidenceConfidence } from '../../types';
import { CONFIDENCE_COLORS } from './chartColors';
import { confidenceLabel } from '../evidence/evidenceUtils';

export interface TooltipRow {
  label: string;
  value: string;      // pre-formatted, includes unit
  color?: string;     // series dot
  muted?: boolean;
  confidence?: EvidenceConfidence;
}

interface Props {
  title?: string;
  rows: TooltipRow[];
  /** Tiny chips under the rows (e.g. evidence sources). */
  chips?: string[];
}

// The one tooltip shell every chart uses — dark surface, series dot + label in text
// ink, value bold, optional confidence badge and evidence chips.
export function TooltipContent({ title, rows, chips }: Props) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl min-w-[150px] animate-[fadeIn_120ms_ease-out]">
      {title && (
        <p className="text-xs font-semibold text-gray-400 mb-2 pb-1.5 border-b border-gray-800">{title}</p>
      )}
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className={clsx('flex items-center justify-between gap-4 text-sm', row.muted && 'opacity-50')}>
            <span className="flex items-center gap-1.5 min-w-0">
              {row.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />}
              <span className="text-gray-300 truncate">{row.label}</span>
            </span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-bold text-white tabular-nums">{row.value}</span>
              {row.confidence && (
                <span
                  className="text-[9px] font-bold px-1.5 py-px rounded-full"
                  style={{ background: `${CONFIDENCE_COLORS[row.confidence]}26`, color: CONFIDENCE_COLORS[row.confidence] }}
                >
                  {confidenceLabel(row.confidence, t)}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-gray-800">
          {chips.map(chip => (
            <span key={chip} className="text-[9px] px-1.5 py-px rounded-full bg-gray-800 text-gray-400">{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}
