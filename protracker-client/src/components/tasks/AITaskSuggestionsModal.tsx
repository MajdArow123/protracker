import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, RefreshCw, Target, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { AILoadingPanel } from '../ui/AILoadingPanel';
import { AIDataSourcesNote } from '../evidence/AIDataSourcesNote';
import { EmptyState } from '../ui/EmptyState';
import { PRIORITY_BADGE, CATEGORY_BADGE, PRIORITY_BORDER } from './taskUtils';
import { useGenerateTaskSuggestions } from '../../hooks/useAI';
import { useCreateTask } from '../../hooks/useTasks';
import { useToast } from '../../context/useToast';
import type { TaskSuggestion, TaskSuggestions } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: { id: number; name: string }[];
  /** When set, the player is fixed (e.g. opened from a player-detail page). */
  lockedPlayerId?: number;
}

export function AITaskSuggestionsModal({ isOpen, onClose, players, lockedPlayerId }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const generate = useGenerateTaskSuggestions();
  const createTask = useCreateTask();

  const AI_MESSAGES = [
    t('tasks.aiMsg1', 'Reviewing the latest assessment…'),
    t('tasks.aiMsg2', 'Finding the weakest areas…'),
    t('tasks.aiMsg3', 'Designing targeted drills…'),
    t('tasks.aiMsg4', 'Matching tasks to position…'),
    t('tasks.aiMsg5', 'Finalising suggestions…'),
  ];

  const [playerId, setPlayerId] = useState<number | ''>(lockedPlayerId ?? '');
  const [result, setResult] = useState<TaskSuggestions | null>(null);
  // Indices of suggestions already assigned (one-click), so we can show a "Assigned" state.
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [assigningIdx, setAssigningIdx] = useState<number | null>(null);

  // Reset transient state whenever the modal opens/closes or the locked player changes.
  useEffect(() => {
    if (isOpen) {
      setPlayerId(lockedPlayerId ?? '');
      setResult(null);
      setAssigned(new Set());
      setAssigningIdx(null);
      generate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lockedPlayerId]);

  async function runGenerate() {
    if (!playerId) return;
    setResult(null);
    setAssigned(new Set());
    try {
      const res = await generate.mutateAsync(Number(playerId));
      setResult(res);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('tasks.failedGenerate', 'Failed to generate suggestions'), 'error');
    }
  }

  async function assign(idx: number, s: TaskSuggestion) {
    if (!result) return;
    setAssigningIdx(idx);
    try {
      await createTask.mutateAsync({
        playerId: result.playerId,
        title: s.title,
        description: s.description || undefined,
        priority: s.priority,
        category: s.category,
      });
      setAssigned(prev => new Set(prev).add(idx));
      addToast(t('tasks.assignedToast', 'Assigned "{{title}}"', { title: s.title }), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('tasks.failedAssign', 'Failed to assign task'), 'error');
    } finally {
      setAssigningIdx(null);
    }
  }

  async function assignAll() {
    if (!result) return;
    for (let i = 0; i < result.suggestions.length; i++) {
      if (!assigned.has(i)) await assign(i, result.suggestions[i]);
    }
  }

  const playerName = result?.playerName
    ?? players.find(p => p.id === Number(playerId))?.name
    ?? '';
  const allAssigned = result != null && assigned.size === result.suggestions.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('tasks.aiSuggestionsTitle', 'AI Task Suggestions')} size="xl">
      {/* Player picker + generate (hidden once we have results) */}
      {!result && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {lockedPlayerId
              ? t('tasks.aiIntroLocked', 'AI analyses the weakest assessment areas and suggests 5 targeted tasks you can add in one click.')
              : t('tasks.aiIntro', 'Pick an athlete and let AI analyse their weakest assessment areas, then suggest 5 targeted tasks you can assign in one click.')}
          </p>
          {!lockedPlayerId && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t('tasks.athlete', 'Athlete')}</label>
              <Select
                value={playerId === '' ? '' : String(playerId)}
                onChange={e => setPlayerId(e.target.value ? Number(e.target.value) : '')}
                options={[{ value: '', label: t('tasks.selectAthlete', 'Select an athlete…') }, ...players.map(p => ({ value: String(p.id), label: p.name }))]}
              />
            </div>
          )}

          {playerId !== '' && !generate.isPending && (
            <AIDataSourcesNote playerId={Number(playerId)} />
          )}

          {generate.isPending ? (
            <AILoadingPanel
              primaryText={t('tasks.analysingName', 'Analysing {{name}}…', { name: playerName || t('tasks.athlete', 'Athlete') })}
              messages={AI_MESSAGES}
              estimatedSeconds={20}
              note={t('tasks.poweredByClaude', 'Powered by Claude — usually ~10–20s')}
            />
          ) : (
            <button
              onClick={runGenerate}
              disabled={!playerId}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                playerId
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20 cursor-pointer'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
              )}
            >
              <Sparkles size={16} /> {t('tasks.generateSuggestions', 'Generate Suggestions')}
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="inline-flex p-2 rounded-xl bg-violet-500/10">
                <Sparkles size={16} className="text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{t('tasks.suggestionsFor', 'Suggestions for {{name}}', { name: result.playerName })}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.tasksReviewAssign', '{{count}} tasks · review and assign', { count: result.suggestions.length })}</p>
              </div>
            </div>
            <button
              onClick={runGenerate}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={13} className={generate.isPending ? 'animate-spin' : ''} /> {t('tasks.regenerate', 'Regenerate')}
            </button>
          </div>

          {/* Weak areas */}
          {result.weakAreas.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 p-3">
              <Target size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">{t('tasks.targetingWeakest', 'Targeting weakest areas')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.weakAreas.map(w => (
                    <span key={w} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {generate.isPending ? (
            <AILoadingPanel primaryText={t('tasks.analysingName', 'Analysing {{name}}…', { name: result.playerName })} messages={AI_MESSAGES} estimatedSeconds={20} />
          ) : result.suggestions.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={28} />} title={t('tasks.noSuggestions', 'No suggestions returned')} description={t('tasks.tryRegenerating', 'Try regenerating.')} size="sm" />
          ) : (
            <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
              {result.suggestions.map((s, idx) => {
                const isAssigned = assigned.has(idx);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={clsx(
                      'rounded-xl border border-l-4 bg-white dark:bg-gray-900 p-3.5 transition-all',
                      PRIORITY_BORDER[s.priority],
                      isAssigned ? 'border-green-200 dark:border-green-900/40 bg-green-50/40 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-800',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', PRIORITY_BADGE[s.priority])}>{L.priority(s.priority)}</span>
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', CATEGORY_BADGE[s.category])}>{L.category(s.category)}</span>
                          {s.focusArea && (
                            <span className="text-[10px] font-medium text-gray-400 inline-flex items-center gap-0.5"><Target size={10} /> {s.focusArea}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</p>
                        {s.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.description}</p>}
                        {s.rationale && <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-1 italic">{s.rationale}</p>}
                      </div>
                      <button
                        onClick={() => assign(idx, s)}
                        disabled={isAssigned || assigningIdx === idx}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all',
                          isAssigned
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer disabled:opacity-60',
                        )}
                      >
                        {isAssigned ? <><Check size={13} /> {t('tasks.assigned', 'Assigned')}</> : assigningIdx === idx ? t('tasks.assigning', 'Assigning…') : <><Sparkles size={13} /> {t('tasks.assign', 'Assign')}</>}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('tasks.assignedOf', '{{assigned}} of {{total}} assigned', { assigned: assigned.size, total: result.suggestions.length })}</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer">
                {allAssigned ? t('common.done', 'Done') : t('common.close', 'Close')}
              </button>
              {!allAssigned && (
                <button
                  onClick={assignAll}
                  disabled={createTask.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Check size={15} /> {t('tasks.assignAll', 'Assign all')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
