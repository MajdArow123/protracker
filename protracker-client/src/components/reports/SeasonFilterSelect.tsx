import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import type { Season } from '../../types';

// S4 opt-in season filter for report pages. The title/explainer line makes the
// two-mechanism difference discoverable (binding ruling): these figures cover records
// assigned to the season BY DATE (row stamps), which can differ from the Seasons page
// summary's period-linked totals.
export function SeasonFilterSelect({ seasons, value, onChange }: {
  seasons: Season[];
  value: number | undefined;
  onChange: (seasonId: number | undefined) => void;
}) {
  const { t } = useTranslation();
  if (seasons.length === 0) return null;
  const explainer = t(
    'seasons.mechanismExplainer',
    "Figures cover records assigned to the season by their date, which can differ from the season summary's period-linked totals.",
  );
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        aria-label={t('seasons.filterLabel', 'Filter by season')}
        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">{t('seasons.allTime', 'All time')}</option>
        {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {value != null && (
        <span title={explainer} className="text-gray-400 cursor-help" aria-label={explainer}>
          <Info size={14} />
        </span>
      )}
    </div>
  );
}
