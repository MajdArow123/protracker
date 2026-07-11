import { useTranslation } from 'react-i18next';
import { Wrench, ListOrdered, AlertTriangle, PlayCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { SportMetricDefinition } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  metric: SportMetricDefinition;
}

// Splits the stored "1. ...\n2. ..." procedure into clean numbered lines.
function procedureSteps(procedure: string): string[] {
  return procedure
    .split('\n')
    .map(line => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(line => line.length > 0);
}

// The "how to measure" guide: equipment, step-by-step procedure and common
// mistakes — so every coach runs the same test the same way.
export function TestProtocolModal({ isOpen, onClose, metric }: Props) {
  const { t } = useTranslation();
  const steps = metric.testProcedure ? procedureSteps(metric.testProcedure) : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={t('evidence.protocolTitle', 'How to measure {{metric}}', { metric: metric.name })}>
      <div className="space-y-5">
        {metric.testSetup && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <Wrench size={12} className="text-indigo-500" /> {t('evidence.protocolSetup', 'Equipment & setup')}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{metric.testSetup}</p>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <ListOrdered size={12} className="text-emerald-500" /> {t('evidence.protocolProcedure', 'Procedure')}
            </h4>
            <ol className="space-y-1.5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-black text-emerald-500 flex-shrink-0 w-5">{i + 1}.</span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {metric.commonMistakes && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-3">
            <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
              <AlertTriangle size={12} /> {t('evidence.protocolMistakes', 'Common mistakes to avoid')}
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{metric.commonMistakes}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {metric.videoUrl ? (
            <a href={metric.videoUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              <PlayCircle size={15} /> {t('evidence.protocolVideo', 'Watch demo video')}
            </a>
          ) : <span />}
          <Button type="button" onClick={onClose}>{t('evidence.protocolGotIt', 'Got it!')}</Button>
        </div>
      </div>
    </Modal>
  );
}
