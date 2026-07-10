import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useAddObjectiveTest, usePlayerObjectiveTests } from '../../hooks/useEvidence';
import type { SportMetricDefinition, EvidenceBasedScore } from '../../types';

interface Props {
  playerId: number;
  metric: SportMetricDefinition;
  onSaved?: (score: EvidenceBasedScore | null) => void;
}

// Records a real measured test value for one metric (sprint time, jump height...).
// Shows the benchmark hint and the most recent recorded value.
export function ObjectiveTestForm({ playerId, metric, onSaved }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const { addToast } = useToast();
  const addTest = useAddObjectiveTest();
  const { data: tests = [] } = usePlayerObjectiveTests(playerId, metric.id);

  const [value, setValue] = useState('');
  const [testedAt, setTestedAt] = useState(new Date().toISOString().split('T')[0]);

  const lastTest = tests[0]; // API returns newest first
  const unit = metric.unit ?? '';

  async function save() {
    const parsed = Number(value);
    if (!value.trim() || Number.isNaN(parsed) || parsed < 0) {
      addToast(t('evidence.enterValidValue', 'Enter a valid test value'), 'error');
      return;
    }
    try {
      const { score } = await addTest.mutateAsync({
        playerId,
        metricDefinitionId: metric.id,
        value: parsed,
        testedAt,
      });
      addToast(t('evidence.testSaved', 'Test result saved'), 'success');
      setValue('');
      onSaved?.(score);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <div className="space-y-3">
      {metric.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{metric.notes}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input
            label={unit
              ? t('evidence.testValueWithUnit', 'Result ({{unit}})', { unit })
              : t('evidence.testValue', 'Result')}
            type="number"
            step="any"
            min={0}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={formatNumber(metric.benchmarkMid)}
          />
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            {t('evidence.benchmarkHint', 'Elite: {{high}}{{unit}} · Average: {{mid}}{{unit}}', {
              high: formatNumber(metric.benchmarkHigh),
              mid: formatNumber(metric.benchmarkMid),
              unit: unit ? ` ${unit}` : '',
            })}
          </p>
        </div>
        <Input
          label={t('evidence.testDate', 'Test date')}
          type="date"
          value={testedAt}
          max={new Date().toISOString().split('T')[0]}
          onChange={e => setTestedAt(e.target.value)}
        />
      </div>

      {lastTest && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <FlaskConical size={12} className="text-indigo-400" />
          {t('evidence.lastTested', 'Last tested: {{date}} — {{value}} {{unit}} (scores {{score}}/10)', {
            date: formatDate(lastTest.testedAt, { month: 'short', day: 'numeric' }),
            value: formatNumber(lastTest.value),
            unit: lastTest.unit,
            score: lastTest.normalizedScore.toFixed(1),
          })}
        </p>
      )}

      {/* type="button": these forms render inside the assessment <form> — never submit it. */}
      <Button type="button" size="sm" onClick={save} isLoading={addTest.isPending} disabled={!value.trim()}>
        {t('evidence.saveTest', 'Save Test Result')}
      </Button>
    </div>
  );
}
