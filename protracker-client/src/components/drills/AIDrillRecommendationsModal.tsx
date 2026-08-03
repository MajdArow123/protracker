import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Target, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AILoadingPanel } from '../ui/AILoadingPanel';
import { EmptyState } from '../ui/EmptyState';
import { AssignDrillModal } from './AssignDrillModal';
import { CATEGORY_BADGE, CATEGORY_LABEL, DIFFICULTY_BADGE } from './drillUtils';
import { useGenerateDrillRecommendations } from '../../hooks/useAI';
import { useToast } from '../../context/useToast';
import type { Drill, DrillRecommendations } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerOption[];
  lockedPlayerId?: number;
  canAssign?: boolean;
}

export function AIDrillRecommendationsModal({ isOpen, onClose, players, lockedPlayerId, canAssign }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const generate = useGenerateDrillRecommendations();

  const AI_MESSAGES = [
    t('drills.aiMsg1', 'Reviewing the latest assessment…'),
    t('drills.aiMsg2', 'Finding the weakest areas…'),
    t('drills.aiMsg3', 'Matching drills to weak areas…'),
    t('drills.aiMsg4', 'Ranking by sport & position…'),
    t('drills.aiMsg5', 'Finalising recommendations…'),
  ];

  const [playerId, setPlayerId] = useState<number | ''>(lockedPlayerId ?? '');
  const [result, setResult] = useState<DrillRecommendations | null>(null);
  const [assigning, setAssigning] = useState<Drill | null>(null);

  useEffect(() => {
    if (isOpen) { setPlayerId(lockedPlayerId ?? ''); setResult(null); generate.reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lockedPlayerId]);

  async function run() {
    if (!playerId) return;
    setResult(null);
    try { setResult(await generate.mutateAsync(Number(playerId))); }
    catch (err) { addToast(err instanceof Error ? err.message : t('drills.failedRecommendations', 'Failed to get recommendations'), 'error'); }
  }

  const loading = generate.isPending;
  const assignPlayerId = lockedPlayerId ?? (result?.playerId);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t('drills.aiTitle', 'AI Drill Recommendations')} size="lg">
        <div className="space-y-4">
          {!lockedPlayerId && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('tasks.athlete', 'Athlete')}</label>
              <select value={playerId} onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : '')} disabled={loading}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white">
                <option value="">{t('tasks.selectAthlete', 'Select an athlete…')}</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {!result && !loading && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('drills.aiIntro', "AI reviews the athlete's weakest assessment areas and picks the drills that help most.")}
              </p>
              <Button onClick={run} disabled={!playerId}><Sparkles size={16} className="mr-1.5" /> {t('drills.getRecommendations', 'Get Recommendations')}</Button>
            </div>
          )}

          {loading && <AILoadingPanel primaryText={t('drills.aiMsg3', 'Matching drills to weak areas…')} messages={AI_MESSAGES} estimatedSeconds={20} />}

          {result && !loading && (
            <div className="space-y-3">
              {result.weakAreas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('drills.basedOnWeak', 'Based on weak areas:')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.weakAreas.map((w, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                        <Target size={10} /> {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.recommendations.length === 0 ? (
                <EmptyState icon={<Sparkles />} title={t('drills.noRecs', 'No recommendations')} description={t('tasks.tryRegenerating', 'Try regenerating.')} size="sm" />
              ) : (
                <div className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.drill.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', DIFFICULTY_BADGE[r.drill.difficulty])}>{L.difficulty(r.drill.difficulty)}</span>
                            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORY_BADGE[r.drill.category])}>{L.category(CATEGORY_LABEL[r.drill.category])}</span>
                            {r.targetCategory && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">{t('drills.targetsCat', 'Targets {{category}}', { category: r.targetCategory })}</span>}
                          </div>
                          {r.reasoning && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5"><span className="font-medium text-gray-600 dark:text-gray-300">{t('drills.whyPrefix', 'Why: ')}</span>{r.reasoning}</p>}
                        </div>
                        {canAssign && (
                          <button onClick={() => setAssigning(r.drill)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex-shrink-0 cursor-pointer">
                            <Plus size={13} /> {t('drills.assign', 'Assign')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-start pt-1">
                <Button variant="ghost" size="sm" onClick={run}><RefreshCw size={14} className="mr-1" /> {t('tasks.regenerate', 'Regenerate')}</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <AssignDrillModal
        isOpen={!!assigning} onClose={() => setAssigning(null)} drill={assigning}
        players={players} lockedPlayerId={assignPlayerId}
      />
    </>
  );
}
