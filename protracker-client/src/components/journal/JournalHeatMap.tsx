import { useMemo } from 'react';
import { clsx } from 'clsx';
import { MOOD_CONFIG, dateKey } from './journalUtils';
import type { JournalEntry } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface Props {
  entries: JournalEntry[];
  weeks?: number;
  onSelectDate?: (key: string) => void;
}

interface Cell {
  key: string;
  date: Date;
  inRange: boolean;
}

// GitHub-style contribution grid: columns are weeks (Sun→Sat), the last column is this week.
export function JournalHeatMap({ entries, weeks = 13, onSelectDate }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const byDate = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const e of entries) map.set(dateKey(new Date(e.entryDate)), e);
    return map;
  }, [entries]);

  const columns = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // End at the Saturday of the current week so the last column is complete.
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1));

    const cols: Cell[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(cursor);
        col.push({ key: dateKey(cell), date: cell, inRange: cell <= today });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [weeks]);

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {col.map((cell) => {
              const entry = byDate.get(cell.key);
              const label = formatDate(cell.date, { month: 'short', day: 'numeric' });
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!entry}
                  onClick={() => entry && onSelectDate?.(cell.key)}
                  title={entry ? `${label} · ${L.mood(entry.mood)}` : label}
                  className={clsx(
                    'w-3.5 h-3.5 rounded-[3px] transition-transform',
                    !cell.inRange && 'opacity-0',
                    entry ? `${MOOD_CONFIG[entry.mood].solid} cursor-pointer hover:scale-125` : 'bg-gray-200 dark:bg-gray-700/60',
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {(['Great', 'Good', 'Okay', 'Tough', 'Rough'] as const).map((m) => (
          <span key={m} className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span className={clsx('w-2.5 h-2.5 rounded-[2px]', MOOD_CONFIG[m].solid)} /> {L.mood(m)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-gray-200 dark:bg-gray-700/60" /> {t('journal.noEntry', 'No entry')}
        </span>
      </div>
    </div>
  );
}
