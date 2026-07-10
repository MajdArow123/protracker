import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAddCoachEvaluation, useAddSelfAssessment } from '../../hooks/useEvidence';
import { guidedQuestionsFor, ratingFromAnswers } from './guidedQuestions';
import { scoreColor } from '../assessments/ScoreWidgets';
import type { SportMetricDefinition, EvidenceBasedScore } from '../../types';

interface Props {
  playerId: number;
  metric: SportMetricDefinition;
  /** Athlete/solo mode: saves a self-assessment instead of a coach evaluation. */
  self?: boolean;
  onSaved?: (score: EvidenceBasedScore | null) => void;
}

// Structured evaluation via guided questions — each answer maps to a numeric value and
// the final 1-10 rating is the average. Saves as CoachEvaluation (coach) or
// SelfAssessmentEntry (athlete/solo).
export function GuidedQuestionsForm({ playerId, metric, self = false, onSaved }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const addCoachEval = useAddCoachEvaluation();
  const addSelfAssess = useAddSelfAssessment(playerId);

  const questions = guidedQuestionsFor(metric.category);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const rating = allAnswered ? ratingFromAnswers(answers) : null;
  const isPending = addCoachEval.isPending || addSelfAssess.isPending;

  async function save() {
    if (rating === null) return;
    const guidedAnswers = JSON.stringify(
      questions.map(q => ({ question: q.id, value: answers[q.id] })),
    );
    try {
      let score: EvidenceBasedScore | null;
      if (self) {
        ({ score } = await addSelfAssess.mutateAsync({
          metricDefinitionId: metric.id,
          rating,
          guidedAnswers,
        }));
      } else {
        ({ score } = await addCoachEval.mutateAsync({
          playerId,
          metricDefinitionId: metric.id,
          rating,
          notes: t('evidence.guidedEvalNote', 'From guided questions'),
        }));
      }
      addToast(t('evidence.evaluationSaved', 'Evaluation saved'), 'success');
      setAnswers({});
      onSaved?.(score);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {questions.map(q => (
        <div key={q.id}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {q.text(t, metric.name)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.value }))}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  answers[q.id] === opt.value
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400',
                )}
              >
                {opt.label(t)}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        {rating !== null ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('evidence.calculatedRating', 'Calculated rating:')}{' '}
            <span className="font-black" style={{ color: scoreColor(rating) }}>{rating.toFixed(1)}/10</span>
          </p>
        ) : (
          <p className="text-xs text-gray-400">{t('evidence.answerAllQuestions', 'Answer all questions to calculate a rating')}</p>
        )}
        {/* type="button": renders inside the assessment <form> — never submit it. */}
        <Button type="button" size="sm" onClick={save} isLoading={isPending} disabled={!allAnswered}>
          {t('evidence.saveEvaluation', 'Save Evaluation')}
        </Button>
      </div>
    </div>
  );
}
