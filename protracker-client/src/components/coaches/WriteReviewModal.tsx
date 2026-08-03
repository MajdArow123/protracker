import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/useToast';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useSports } from '../../hooks/useSports';
import { useSubmitReview } from '../../hooks/useCoachReviews';

export function WriteReviewModal({ slug, coachName, defaultSportId, isOpen, onClose }: {
  slug: string; coachName: string; defaultSportId?: number | null; isOpen: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { addToast } = useToast();
  const { data: sports = [] } = useSports();
  const submit = useSubmitReview(slug);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sportId, setSportId] = useState<number | null>(defaultSportId ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRating(0); setHover(0); setTitle(''); setContent(''); setSportId(defaultSportId ?? null); setError('');
    }
  }, [isOpen, defaultSportId]);

  const handleSubmit = async () => {
    if (rating < 1) { setError(t('coaches.selectStarRating', 'Please select a star rating.')); return; }
    setError('');
    try {
      await submit.mutateAsync({ rating, title: title.trim() || null, content: content.trim() || null, sport: sportId });
      addToast(t('coaches.reviewSubmitted', 'Review submitted — thank you!'), 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('coaches.failedToSubmitReview', 'Failed to submit review.'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('coaches.reviewCoach', 'Review {{name}}', { name: coachName })} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('coaches.yourRating', 'Your rating')}</label>
          <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="cursor-pointer transition-transform hover:scale-110">
                <Star size={32} className={clsx((hover || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('coaches.reviewTitle', 'Title')} <span className="text-gray-400 font-normal">({t('common.optional', 'optional')})</span></label>
          <input value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} placeholder={t('coaches.reviewTitlePlaceholder', 'Sum up your experience')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('coaches.yourReview', 'Your review')} <span className="text-gray-400 font-normal">({t('common.optional', 'optional')})</span></label>
          <textarea value={content} onChange={e => setContent(e.target.value.slice(0, 1000))} rows={4} placeholder={t('coaches.reviewContentPlaceholder', 'What was it like training with this coach?')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('coaches.sportYouTrained', 'Sport you trained')}</label>
          <select value={sportId ?? ''} onChange={e => setSportId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">{t('coaches.selectSport', 'Select a sport')}</option>
            {sports.map(s => <option key={s.id} value={s.id}>{dyn.sport(s.name)}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={submit.isPending}>{t('coaches.submitReview', 'Submit Review')}</Button>
        </div>
      </div>
    </Modal>
  );
}
