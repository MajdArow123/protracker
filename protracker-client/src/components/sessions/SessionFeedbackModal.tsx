import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Star, CalendarDays, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { useSubmitSessionFeedback } from '../../hooks/useSessionFeedback';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { ScheduledSession, SessionFeedback } from '../../types';

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="cursor-pointer transition-transform hover:scale-110"
          aria-label={t('sessions.starRatingAria', '{{count}} stars', { count: n })}
        >
          <Star
            size={30}
            className={clsx(n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')}
          />
        </button>
      ))}
    </div>
  );
}

function DotScale({ value, onChange, lowLabel, highLabel }: {
  value: number; onChange: (v: number) => void; lowLabel: string; highLabel: string;
}) {
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={clsx(
              'flex-1 h-10 rounded-xl border text-sm font-semibold transition-all cursor-pointer',
              n === value
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-300'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-gray-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function SessionFeedbackModal({ session, existing, isOpen, onClose }: {
  session: ScheduledSession | null;
  existing?: SessionFeedback | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();
  const submit = useSubmitSessionFeedback();

  const [rating, setRating] = useState(0);
  const [energyBefore, setEnergyBefore] = useState(3);
  const [energyAfter, setEnergyAfter] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWasHard, setWhatWasHard] = useState('');
  const [injuryNote, setInjuryNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setRating(existing?.rating ?? 0);
    setEnergyBefore(existing?.energyBefore ?? 3);
    setEnergyAfter(existing?.energyAfter ?? 3);
    setDifficulty(existing?.difficulty ?? 3);
    setWhatWentWell(existing?.whatWentWell ?? '');
    setWhatWasHard(existing?.whatWasHard ?? '');
    setInjuryNote(existing?.injuryNote ?? '');
    setError('');
  }, [isOpen, existing]);

  if (!session) return null;

  const handleSubmit = async () => {
    if (rating < 1) { setError(t('sessions.errRating', 'Please give the session a star rating.')); return; }
    setError('');
    try {
      await submit.mutateAsync({
        sessionId: session.id,
        data: {
          rating, energyBefore, energyAfter, difficulty,
          whatWentWell: whatWentWell.trim() || null,
          whatWasHard: whatWasHard.trim() || null,
          injuryNote: injuryNote.trim() || null,
        },
      });
      addToast(existing ? t('sessions.feedbackUpdated', 'Feedback updated') : t('sessions.feedbackThanks', 'Thanks for your feedback!'), 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('sessions.errSubmit', 'Failed to submit feedback.'));
    }
  };

  const sessionDate = formatDate(session.startTime, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('sessions.feedbackTitle', 'How did the session go?')} size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <CalendarDays size={18} className="text-indigo-500" />
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{session.title}</div>
            <div className="text-xs text-gray-500">{sessionDate}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.overallRating', 'Overall rating')}</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.energyBefore', 'Energy before')}</label>
            <DotScale value={energyBefore} onChange={setEnergyBefore} lowLabel={t('sessions.drained', 'Drained')} highLabel={t('sessions.fresh', 'Fresh')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.energyAfter', 'Energy after')}</label>
            <DotScale value={energyAfter} onChange={setEnergyAfter} lowLabel={t('sessions.drained', 'Drained')} highLabel={t('sessions.fresh', 'Fresh')} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.difficulty', 'Difficulty')}</label>
          <DotScale value={difficulty} onChange={setDifficulty} lowLabel={t('sessions.easy', 'Easy')} highLabel={t('sessions.brutal', 'Brutal')} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('sessions.whatWentWell', 'What went well?')}</label>
          <textarea
            value={whatWentWell}
            onChange={e => setWhatWentWell(e.target.value)}
            rows={2}
            placeholder={t('common.optional', 'Optional')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('sessions.whatWasHard', 'What was hard?')}</label>
          <textarea
            value={whatWasHard}
            onChange={e => setWhatWasHard(e.target.value)}
            rows={2}
            placeholder={t('common.optional', 'Optional')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <AlertTriangle size={14} className="text-amber-500" /> {t('sessions.painInjury', 'Any pain or injury?')}
          </label>
          <textarea
            value={injuryNote}
            onChange={e => setInjuryNote(e.target.value)}
            rows={2}
            placeholder={t('sessions.injuryPlaceholder', 'Leave blank if you felt fine — your coach is alerted if you note pain')}
            className="w-full rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-900/10 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={submit.isPending}>
            {existing ? t('sessions.updateFeedback', 'Update feedback') : t('sessions.submitFeedback', 'Submit feedback')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
