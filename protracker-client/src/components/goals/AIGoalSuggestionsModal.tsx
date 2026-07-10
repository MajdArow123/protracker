import { useState, useEffect } from 'react';
import { Sparkles, Check, RefreshCw, Target, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AILoadingPanel } from '../ui/AILoadingPanel';
import { EmptyState } from '../ui/EmptyState';
import { CATEGORY_BADGE } from './goalUtils';
import { useGenerateGoalSuggestions } from '../../hooks/useAI';
import { useCreateGoal } from '../../hooks/useGoals';
import { useToast } from '../../context/ToastContext';
import type { GoalSuggestion, GoalSuggestions } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: { id: number; name: string }[];
  lockedPlayerId?: number;
}

function targetDateFromWeeks(weeks?: number | null): string | null {
  if (!weeks) return null;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function AIGoalSuggestionsModal({ isOpen, onClose, players, lockedPlayerId }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const generate = useGenerateGoalSuggestions();
  const createGoal = useCreateGoal();

  const AI_MESSAGES = [
    t('goals.aiMsg1', 'Reviewing the latest assessment…'),
    t('goals.aiMsg2', 'Finding the weakest areas…'),
    t('goals.aiMsg3', 'Setting measurable targets…'),
    t('goals.aiMsg4', 'Matching goals to sport & position…'),
    t('goals.aiMsg5', 'Finalising suggestions…'),
  ];

  const [playerId, setPlayerId] = useState<number | ''>(lockedPlayerId ?? '');
  const [result, setResult] = useState<GoalSuggestions | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPlayerId(lockedPlayerId ?? '');
      setResult(null);
      setAdded(new Set());
      setAddingIdx(null);
      generate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lockedPlayerId]);

  async function runGenerate() {
    if (!playerId) return;
    setResult(null);
    setAdded(new Set());
    try {
      const res = await generate.mutateAsync(Number(playerId));
      setResult(res);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('goals.failedGenerate', 'Failed to generate suggestions'), 'error');
    }
  }

  async function add(idx: number, s: GoalSuggestion) {
    if (!result) return;
    setAddingIdx(idx);
    try {
      await createGoal.mutateAsync({
        playerId: result.playerId,
        title: s.title,
        description: s.description || null,
        category: s.category,
        targetValue: s.targetValue ?? null,
        currentValue: s.currentValue ?? null,
        unit: s.unit || null,
        linkedStatCategoryId: s.linkedStatCategoryId ?? null,
        targetDate: targetDateFromWeeks(s.timelineWeeks),
        priority: 'Medium',
        isPrivate: false,
      });
      setAdded(prev => new Set(prev).add(idx));
      addToast(t('goals.addedToast', 'Added "{{title}}"', { title: s.title }), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('goals.failedAdd', 'Failed to add goal'), 'error');
    } finally {
      setAddingIdx(null);
    }
  }

  async function addAll() {
    if (!result) return;
    for (let i = 0; i < result.suggestions.length; i++) {
      if (!added.has(i)) await add(i, result.suggestions[i]);
    }
  }

  const loading = generate.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('goals.suggestGoalsAI', 'Suggest Goals with AI')} size="lg">
      <div className="space-y-4">
        {!lockedPlayerId && (
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('goals.athlete', 'Athlete')}</label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">{t('goals.selectAthlete', 'Select an athlete…')}</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {!result && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('goals.aiIntro', "AI analyses the athlete's weakest assessment areas and suggests measurable, sport-specific goals.")}
            </p>
            <Button onClick={runGenerate} disabled={!playerId}>
              <Sparkles size={16} className="mr-1.5" /> {t('goals.generateSuggestions', 'Generate Suggestions')}
            </Button>
          </div>
        )}

        {loading && <AILoadingPanel primaryText={t('goals.analysingWeak', 'Analysing weak areas…')} messages={AI_MESSAGES} estimatedSeconds={20} />}

        {result && !loading && (
          <div className="space-y-3">
            {result.weakAreas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('goals.basedOnWeak', 'Based on weak areas:')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.weakAreas.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                      <Target size={10} /> {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.suggestions.length === 0 ? (
              <EmptyState icon={<Sparkles />} title={t('goals.noSuggestions', 'No suggestions')} description={t('goals.tryRegenerating', 'Try regenerating.')} />
            ) : (
              <div className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{s.title}</p>
                        {s.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.description}</p>}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', CATEGORY_BADGE[s.category])}>{L.category(s.category)}</span>
                          {s.targetValue != null && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('goals.targetValueLabel', 'Target {{value}}', { value: `${s.targetValue}${s.unit ? ` ${s.unit}` : ''}` })}</span>
                          )}
                          {s.timelineWeeks != null && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400"><Clock size={10} /> {t('goals.weeksShort', '{{count}}w', { count: s.timelineWeeks })}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => add(i, s)}
                        disabled={added.has(i) || addingIdx === i}
                        className={clsx(
                          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 cursor-pointer',
                          added.has(i) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700',
                        )}
                      >
                        {added.has(i) ? <><Check size={13} /> {t('goals.added', 'Added')}</> : addingIdx === i ? t('goals.adding', 'Adding…') : t('common.add', 'Add')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={runGenerate}><RefreshCw size={14} className="mr-1" /> {t('goals.regenerate', 'Regenerate')}</Button>
              {result.suggestions.length > 0 && (
                <Button size="sm" onClick={addAll} disabled={added.size === result.suggestions.length}>{t('goals.addAll', 'Add all')}</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
