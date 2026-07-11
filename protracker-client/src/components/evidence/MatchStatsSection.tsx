import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { BarChart2, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { usePlayerMatchStats } from '../../hooks/useEvidence';
import { MATCH_STAT_FIELDS } from './matchStatFields';

interface Props {
  playerId: number;
  sportId: number | null | undefined;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="font-bold text-white">{payload[0].value}</p>
    </div>
  );
}

// Aggregated match statistics: per-stat averages, a trend chart for the selected
// stat, and the best single-match performance for it.
export function MatchStatsSection({ playerId, sportId }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const { data: entries = [] } = usePlayerMatchStats(playerId);

  const fields = useMemo(() => MATCH_STAT_FIELDS[sportId ?? 0] ?? [], [sportId]);
  const sorted = useMemo(() => [...entries]
    .sort((a, b) => new Date(a.statDate).getTime() - new Date(b.statDate).getTime()),
    [entries]);

  // Only stats that actually appear in at least one entry.
  const presentFields = useMemo(
    () => fields.filter(f => sorted.some(e => e.stats[f.key] !== undefined)),
    [fields, sorted]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = selectedKey ?? presentFields[0]?.key ?? null;
  const activeField = presentFields.find(f => f.key === activeKey);

  const averages = useMemo(() => presentFields.map(f => {
    const values = sorted.map(e => e.stats[f.key]).filter((v): v is number => v !== undefined);
    return {
      key: f.key,
      label: f.label(t),
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      isPct: f.kind === '%',
    };
  }), [presentFields, sorted, t]);

  if (entries.length === 0 || fields.length === 0) return null;

  const chartData = sorted
    .filter(e => activeKey != null && e.stats[activeKey] !== undefined)
    .map(e => ({
      date: formatDate(e.statDate, { month: 'short', day: 'numeric' }),
      value: e.stats[activeKey!],
    }));
  // "Best" match for the selected stat (errors/turnovers-style stats: lower is better).
  const lowerBetter = activeKey != null && /error|fault|turnover/i.test(activeKey);
  const bestValue = chartData.length
    ? (lowerBetter ? Math.min(...chartData.map(d => d.value)) : Math.max(...chartData.map(d => d.value)))
    : null;
  const bestMatch = chartData.find(d => d.value === bestValue);

  return (
    <Card header={
      <span className="flex items-center gap-2">
        <BarChart2 size={15} className="text-sky-500" />
        {t('evidence.matchStatsTitle', 'Match Statistics')}
        <span className="text-xs font-normal text-gray-400">
          {t('evidence.matchCount', '{{count}} matches', { count: entries.length })}
        </span>
      </span>
    }>
      {/* Season averages */}
      <div className="flex flex-wrap gap-2 mb-4">
        {averages.map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => setSelectedKey(a.key)}
            className={clsx(
              'rounded-xl px-3 py-1.5 text-left transition-colors cursor-pointer border',
              a.key === activeKey
                ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
                : 'border-gray-200 dark:border-gray-800 hover:border-sky-300',
            )}
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{a.label}</p>
            <p className="text-sm font-black text-gray-900 dark:text-white">
              {formatNumber(Math.round(a.avg * 10) / 10)}{a.isPct ? '%' : ''}
              <span className="text-[10px] font-medium text-gray-400 ms-1">{t('evidence.avg', 'avg')}</span>
            </p>
          </button>
        ))}
      </div>

      {activeField && chartData.length >= 2 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2}
              dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-xs text-gray-400 py-2">
          {t('evidence.needTwoMatches', 'Record stats from a second match to see the trend.')}
        </p>
      )}

      {bestMatch && activeField && chartData.length >= 2 && (
        <p className="mt-2 text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
          <Star size={12} />
          {t('evidence.bestPerformance', 'Best: {{value}}{{pct}} ({{label}}) on {{date}}', {
            value: formatNumber(bestMatch.value),
            pct: activeField.kind === '%' ? '%' : '',
            label: activeField.label(t),
            date: bestMatch.date,
          })}
        </p>
      )}
    </Card>
  );
}
