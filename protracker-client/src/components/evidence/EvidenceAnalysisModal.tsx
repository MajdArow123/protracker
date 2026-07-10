import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ClipboardList, FlaskConical, Map } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AILoadingPanel } from '../ui/AILoadingPanel';
import { useToast } from '../../context/ToastContext';
import { useGenerateEvidenceAnalysis } from '../../hooks/useAI';
import type { EvidenceAnalysis } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: number;
}

// AI "Evidence Quality Report": what evidence is missing, which metrics would benefit
// most from objective tests, a recommended test battery, and a confidence roadmap.
export function EvidenceAnalysisModal({ isOpen, onClose, playerId }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const generate = useGenerateEvidenceAnalysis();
  const [analysis, setAnalysis] = useState<EvidenceAnalysis | null>(null);

  async function run() {
    try {
      setAnalysis(await generate.mutateAsync(playerId));
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('evidence.analysisTitle', 'Evidence Quality Report')} size="lg">
      {generate.isPending ? (
        <AILoadingPanel
          primaryText={t('evidence.analysisLoading', 'Analyzing evidence quality…')}
          messages={[
            t('evidence.analysisMsg1', 'Reviewing recorded tests and match stats'),
            t('evidence.analysisMsg2', 'Finding the metrics that need real data most'),
            t('evidence.analysisMsg3', 'Building a test battery for this position'),
          ]}
          estimatedSeconds={15}
          compact
        />
      ) : analysis ? (
        <div className="space-y-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>

          {analysis.priorities.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ClipboardList size={12} /> {t('evidence.analysisPriorities', 'What to collect next')}
              </h4>
              <div className="space-y-2">
                {analysis.priorities.map((p, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.metric}</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">{p.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.testBattery.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <FlaskConical size={12} /> {t('evidence.analysisTestBattery', 'Recommended test session')}
              </h4>
              <ul className="space-y-1">
                {analysis.testBattery.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                    <span className="text-indigo-500 font-bold flex-shrink-0">{i + 1}.</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.roadmap.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Map size={12} /> {t('evidence.analysisRoadmap', 'Confidence roadmap')}
              </h4>
              <ul className="space-y-1">
                {analysis.roadmap.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                    <span className="text-emerald-500 flex-shrink-0">→</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={run}>
              <Sparkles size={13} /> {t('common.regenerate', 'Regenerate')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {t('evidence.analysisIntro',
              'The AI reviews every metric, spots where scores rely on estimates, and recommends exactly which tests and stats to record next.')}
          </p>
          <Button type="button" onClick={run}>
            <Sparkles size={15} /> {t('evidence.analysisGenerate', 'Generate Report')}
          </Button>
        </div>
      )}
    </Modal>
  );
}
