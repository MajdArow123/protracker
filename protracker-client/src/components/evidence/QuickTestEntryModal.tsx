import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { TestProtocolModal } from './TestProtocolModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/useToast';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useSportMetrics, useAddObjectiveTest } from '../../hooks/useEvidence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: number;
  playerName: string;
  sportId: number | null | undefined;
}

// One-tap test logging from a player card: the sport's signature test is pre-selected,
// enter a value, save. Renders as a bottom sheet on mobile (Modal handles that).
export function QuickTestEntryModal({ isOpen, onClose, playerId, playerName, sportId }: Props) {
  const { t } = useTranslation();
  const { formatNumber } = useLocaleFormat();
  const { addToast } = useToast();
  const { data: metrics = [] } = useSportMetrics(sportId, isOpen);
  const addTest = useAddObjectiveTest();

  // Metrics with a real measured test; the sport's required ones (sprint/jump) first.
  const testable = useMemo(() => metrics
    .filter(m => m.inputType !== 'Rating')
    .sort((a, b) => Number(b.isObjectiveRequired) - Number(a.isObjectiveRequired)),
    [metrics]);

  const [metricId, setMetricId] = useState<number | null>(null);
  const [value, setValue] = useState('');
  const [showProtocol, setShowProtocol] = useState(false);
  const activeId = metricId ?? testable[0]?.id ?? null;
  const metric = testable.find(m => m.id === activeId);

  useEffect(() => {
    if (isOpen) { setMetricId(null); setValue(''); }
  }, [isOpen]);

  async function save() {
    const parsed = Number(value);
    if (!metric || !value.trim() || Number.isNaN(parsed) || parsed < 0) {
      addToast(t('evidence.enterValidValue', 'Enter a valid test value'), 'error');
      return;
    }
    try {
      await addTest.mutateAsync({ playerId, metricDefinitionId: metric.id, value: parsed });
      addToast(t('evidence.testSaved', 'Test result saved'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('evidence.quickTestTitle', 'Log Test — {{name}}', { name: playerName })}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {testable.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setMetricId(m.id); setValue(''); }}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                m.id === activeId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {m.name}
            </button>
          ))}
        </div>

        {metric && (
          <>
            <div className="flex items-start justify-between gap-2">
              {metric.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{metric.notes}</p>}
              {(metric.testSetup || metric.testProcedure) && (
                <button type="button" onClick={() => setShowProtocol(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex-shrink-0 ms-auto">
                  <HelpCircle size={11} /> {t('evidence.howToMeasure', 'How to measure')}
                </button>
              )}
            </div>
            <div>
              <Input
                label={metric.unit
                  ? t('evidence.testValueWithUnit', 'Result ({{unit}})', { unit: metric.unit })
                  : t('evidence.testValue', 'Result')}
                type="number"
                step="any"
                min={0}
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={formatNumber(metric.benchmarkMid)}
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                {t('evidence.benchmarkHint', 'Elite: {{high}}{{unit}} · Average: {{mid}}{{unit}}', {
                  high: formatNumber(metric.benchmarkHigh),
                  mid: formatNumber(metric.benchmarkMid),
                  unit: metric.unit ? ` ${metric.unit}` : '',
                })}
              </p>
            </div>
          </>
        )}

        <Button type="button" className="w-full justify-center" onClick={save}
          isLoading={addTest.isPending} disabled={!value.trim()}>
          <FlaskConical size={15} /> {t('evidence.saveTest', 'Save Test Result')}
        </Button>

        {showProtocol && metric && (
          <TestProtocolModal isOpen={showProtocol} onClose={() => setShowProtocol(false)} metric={metric} />
        )}
      </div>
    </Modal>
  );
}
