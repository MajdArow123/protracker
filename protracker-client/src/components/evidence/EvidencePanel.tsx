import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, FlaskConical, BarChart2, MessageSquareText, ShieldCheck, Sparkles, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ObjectiveTestForm } from './ObjectiveTestForm';
import { MatchStatsForm } from './MatchStatsForm';
import { GuidedQuestionsForm } from './GuidedQuestionsForm';
import { ScorePreviewCard } from './ScorePreviewCard';
import { confidenceBadgeClass, confidenceLabel, isVerified } from './evidenceUtils';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { SportMetricDefinition, EvidenceBasedScore } from '../../types';

type EvidenceTab = 'tests' | 'match' | 'guided';

interface Props {
  playerId: number;
  metric: SportMetricDefinition;
  /** Current calculated score for this metric, when one exists. */
  score?: EvidenceBasedScore;
  /** Athlete/solo mode: guided questions save as self-assessment ("Self Evaluation"). */
  self?: boolean;
  teamId?: number | null;
  /** Team athletes may not record match stats (coach/solo only on the backend). */
  canEnterMatchStats?: boolean;
  /** When set, the preview offers "Apply this score" to push onto the slider. */
  onApplyScore?: (value: number) => void;
}

const WELCOME_KEY = 'pt_evidence_welcome_seen';

// Collapsible "Add Evidence" section shown under a slider card (or inside the breakdown
// modal). Three entry tabs; after any save the fresh calculated score previews inline.
export function EvidencePanel({ playerId, metric, score, self = false, teamId, canEnterMatchStats = true, onApplyScore }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // One-time welcome the first time anyone expands an evidence panel.
  const [showWelcome, setShowWelcome] = useState(false);

  function toggleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && !localStorage.getItem(WELCOME_KEY)) setShowWelcome(true);
      return next;
    });
  }

  function dismissWelcome() {
    localStorage.setItem(WELCOME_KEY, '1');
    setShowWelcome(false);
  }
  // The score returned by the last save wins over the (possibly stale) cached prop.
  const [freshScore, setFreshScore] = useState<EvidenceBasedScore | null>(null);

  const hasObjectiveTab = metric.inputType !== 'Rating';
  const hasMatchTab = metric.supportsMatchStats && canEnterMatchStats;
  const [tab, setTab] = useState<EvidenceTab>(hasObjectiveTab ? 'tests' : 'guided');

  const current = freshScore ?? score ?? null;
  const verified = current != null && isVerified(current.confidence);

  const tabs: { id: EvidenceTab; label: string; icon: typeof FlaskConical }[] = [
    ...(hasObjectiveTab ? [{ id: 'tests' as const, label: t('evidence.tabTests', 'Objective Tests'), icon: FlaskConical }] : []),
    ...(hasMatchTab ? [{ id: 'match' as const, label: t('evidence.tabMatchStats', 'Match Stats'), icon: BarChart2 }] : []),
    {
      id: 'guided' as const,
      label: self ? t('evidence.tabSelfEval', 'Self Evaluation') : t('evidence.tabGuided', 'Guided Questions'),
      icon: MessageSquareText,
    },
  ];

  function onScoresSaved(scores: EvidenceBasedScore[]) {
    const mine = scores.find(s => s.metricDefinitionId === metric.id);
    if (mine) setFreshScore(mine);
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 mt-1">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center gap-2 px-1 py-2 text-xs cursor-pointer group"
      >
        <ShieldCheck size={13} className={verified ? 'text-emerald-500' : 'text-gray-400'} />
        {current ? (
          <span className={clsx('font-semibold px-2 py-0.5 rounded-full', confidenceBadgeClass(current.confidence))}>
            {t('evidence.badgeWithLevel', 'Evidence: {{level}} confidence', { level: confidenceLabel(current.confidence, t) })}
            {verified && ' ✓'}
          </span>
        ) : (
          <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">
            {t('evidence.badgeEmpty', 'Evidence: none yet — click to add')}
          </span>
        )}
        <ChevronDown size={14} className={clsx('ml-auto text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-3 space-y-3">
              {showWelcome && (
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-200 dark:border-indigo-900/40 p-2.5 flex items-start gap-2">
                  <Sparkles size={13} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-snug flex-1">
                    {t('evidence.welcomeTip',
                      'Evidence-based scoring uses real test data to calculate accurate scores. Follow the test protocols ("How to measure") for consistent, comparable results.')}
                  </p>
                  <button type="button" onClick={dismissWelcome}
                    className="p-0.5 rounded text-indigo-400 hover:text-indigo-600 cursor-pointer flex-shrink-0"
                    aria-label={t('common.dismiss', 'Dismiss')}>
                    <X size={12} />
                  </button>
                </div>
              )}
              {isMobile && tabs.length > 1 ? (
                /* Phones get a dropdown — pills wrap awkwardly at 360px with long labels */
                <select
                  value={tab}
                  onChange={e => setTab(e.target.value as EvidenceTab)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  aria-label={t('evidence.evidenceType', 'Evidence type')}
                >
                  {tabs.map(tb => (
                    <option key={tb.id} value={tb.id}>{tb.label}</option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-1 flex-wrap">
                  {tabs.map(tb => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setTab(tb.id)}
                      className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer',
                        tab === tb.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                      )}
                    >
                      <tb.icon size={11} /> {tb.label}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'tests' && hasObjectiveTab && (
                <ObjectiveTestForm playerId={playerId} metric={metric} onSaved={s => s && setFreshScore(s)} />
              )}
              {tab === 'match' && hasMatchTab && (
                <MatchStatsForm playerId={playerId} sportId={metric.sportId} teamId={teamId} onSaved={onScoresSaved} />
              )}
              {tab === 'guided' && (
                <GuidedQuestionsForm playerId={playerId} metric={metric} self={self} onSaved={s => s && setFreshScore(s)} />
              )}

              {current && (
                <ScorePreviewCard score={current} onApply={onApplyScore} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
