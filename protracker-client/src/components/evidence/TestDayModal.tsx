import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useSportMetrics } from '../../hooks/useEvidence';
import { evidenceApi } from '../../api/evidenceApi';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sportId: number | null | undefined;
  players: PlayerOption[];
}

// "Test Day" batch entry: pick one test, run down the squad entering results, save all
// at once — built for a coach with a stopwatch at the end of training.
export function TestDayModal({ isOpen, onClose, sportId, players }: Props) {
  const { t } = useTranslation();
  const { formatNumber } = useLocaleFormat();
  const { addToast } = useToast();
  const qc = useQueryClient();
  const { data: metrics = [] } = useSportMetrics(sportId, isOpen);

  const testable = useMemo(() => metrics
    .filter(m => m.inputType !== 'Rating')
    .sort((a, b) => Number(b.isObjectiveRequired) - Number(a.isObjectiveRequired)),
    [metrics]);

  const [metricId, setMetricId] = useState<number | null>(null);
  const [testedAt, setTestedAt] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const metric = testable.find(m => m.id === metricId);

  useEffect(() => {
    if (isOpen) { setMetricId(null); setValues({}); setTestedAt(new Date().toISOString().split('T')[0]); }
  }, [isOpen]);

  const entries = players
    .map(p => ({ player: p, raw: values[p.id]?.trim() ?? '' }))
    .filter(e => e.raw.length > 0);

  async function saveAll() {
    if (!metric || entries.length === 0) return;
    for (const e of entries) {
      const n = Number(e.raw);
      if (Number.isNaN(n) || n < 0) {
        addToast(t('evidence.invalidValueFor', 'Invalid value for {{name}}', { name: e.player.name }), 'error');
        return;
      }
    }
    setSaving(true);
    try {
      // Sequential on purpose: keeps server load gentle and error attribution clear.
      for (const e of entries) {
        await evidenceApi.addObjectiveTest({
          playerId: e.player.id,
          metricDefinitionId: metric.id,
          value: Number(e.raw),
          testedAt,
        });
      }
      // One recalculation sweep per player, then refresh the evidence caches.
      for (const e of entries) await evidenceApi.recalculateAll(e.player.id);
      qc.invalidateQueries({ queryKey: ['evidence'] });
      addToast(t('evidence.testDaySaved', 'Saved {{count}} test results', { count: entries.length }), 'success');
      onClose();
    } catch (err) {
      qc.invalidateQueries({ queryKey: ['evidence'] });
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('evidence.testDayTitle', 'Test Day')} size="lg">
      {!metric ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('evidence.testDayIntro', 'Pick the test you ran, then enter every player’s result in one go.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {testable.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetricId(m.id)}
                className="text-left rounded-xl border border-gray-200 dark:border-gray-800 p-3 hover:border-indigo-400 transition-colors cursor-pointer"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <FlaskConical size={13} className="text-indigo-500" /> {m.name}
                </p>
                {m.notes && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{m.notes}</p>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button type="button" onClick={() => setMetricId(null)}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
              <ArrowLeft size={12} /> {metric.name}
              {metric.unit && <span className="text-gray-400 font-normal">({metric.unit})</span>}
            </button>
            <div className="w-40">
              <Input type="date" value={testedAt} max={new Date().toISOString().split('T')[0]}
                onChange={e => setTestedAt(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            {t('evidence.benchmarkHint', 'Elite: {{high}}{{unit}} · Average: {{mid}}{{unit}}', {
              high: formatNumber(metric.benchmarkHigh), mid: formatNumber(metric.benchmarkMid),
              unit: metric.unit ? ` ${metric.unit}` : '',
            })}
          </p>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pe-1">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={clsx('flex-1 text-sm truncate',
                  values[p.id]?.trim() ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
                  {p.name}
                </span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={values[p.id] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={formatNumber(metric.benchmarkMid)}
                  className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>

          <Button type="button" className="w-full justify-center" onClick={saveAll}
            isLoading={saving} disabled={entries.length === 0}>
            {t('evidence.testDaySaveAll', 'Save {{count}} results', { count: entries.length })}
          </Button>
        </div>
      )}
    </Modal>
  );
}
