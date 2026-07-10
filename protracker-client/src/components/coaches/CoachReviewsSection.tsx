import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Star, BadgeCheck, MessageSquare, Trash2, CornerDownRight } from 'lucide-react';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCoachReviews, useRespondToReview, useDeleteReview } from '../../hooks/useCoachReviews';
import { WriteReviewModal } from './WriteReviewModal';
import type { CoachReview } from '../../types';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} className={clsx(n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-600')} />
      ))}
    </div>
  );
}

function fmt(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReviewCard({ review, slug, isOwner }: { review: CoachReview; slug: string; isOwner: boolean }) {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { addToast } = useToast();
  const respond = useRespondToReview(slug);
  const del = useDeleteReview(slug);
  const [responding, setResponding] = useState(false);
  const [text, setText] = useState(review.coachResponse ?? '');

  const postResponse = async () => {
    try {
      await respond.mutateAsync({ id: review.id, response: text.trim() });
      addToast(t('coaches.responsePosted', 'Response posted'), 'success');
      setResponding(false);
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('coaches.failed', 'Failed'), 'error');
    }
  };

  const remove = async () => {
    try {
      await del.mutateAsync(review.id);
      addToast(t('coaches.reviewDeleted', 'Review deleted'), 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : t('coaches.failed', 'Failed'), 'error');
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{review.reviewerName}</span>
            {review.isVerified && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-semibold">
                <BadgeCheck size={11} /> {t('coaches.verifiedAthlete', 'Verified athlete')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars value={review.rating} />
            {review.sportName && <span className="text-xs text-gray-400">{t('coaches.trainedFor', 'trained for {{sport}}', { sport: dyn.sport(review.sportName) })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500">{fmt(review.createdAt)}</span>
          {review.isMine && (
            <button onClick={remove} className="text-gray-500 hover:text-red-400 cursor-pointer" title={t('coaches.deleteMyReview', 'Delete my review')}><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {review.title && <p className="font-semibold text-white mt-2">{review.title}</p>}
      {review.content && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{review.content}</p>}

      {review.coachResponse && (
        <div className="mt-3 ml-3 pl-3 border-l-2 border-indigo-500/40 bg-indigo-500/5 rounded-r-lg py-2 pr-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-indigo-300 mb-0.5"><CornerDownRight size={12} /> {t('coaches.coachResponse', "Coach's response")}</div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{review.coachResponse}</p>
        </div>
      )}

      {isOwner && (
        <div className="mt-3">
          {responding ? (
            <div className="space-y-2">
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 1000))} rows={2} placeholder={t('coaches.writeResponsePlaceholder', 'Write a response…')}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button onClick={postResponse} disabled={respond.isPending} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">{t('coaches.postResponse', 'Post Response')}</button>
                <button onClick={() => setResponding(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-xs font-semibold cursor-pointer">{t('common.cancel', 'Cancel')}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setText(review.coachResponse ?? ''); setResponding(true); }} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
              <MessageSquare size={12} /> {review.coachResponse ? t('coaches.editResponse', 'Edit response') : t('coaches.respond', 'Respond')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CoachReviewsSection({ slug, coachName, sportId }: { slug: string; coachName: string; sportId?: number | null }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useCoachReviews(slug);
  const [writeOpen, setWriteOpen] = useState(false);

  if (!data) return null;

  const canReview = (user?.role === 'Athlete' || user?.role === 'SoloAthlete') && !data.hasReviewed;
  const max = Math.max(...Object.values(data.distribution), 1);

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t('coaches.reviews', 'Reviews')}</h2>
        {canReview && (
          <button onClick={() => setWriteOpen(true)} className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
            {t('coaches.writeReview', 'Write a Review')}
          </button>
        )}
      </div>

      {data.reviewCount === 0 ? (
        <p className="text-sm text-gray-400">{t('coaches.noReviewsYet', 'No reviews yet.')} {canReview && t('coaches.beTheFirst', 'Be the first to leave one!')}</p>
      ) : (
        <>
          {/* Summary */}
          <div className="flex flex-col sm:flex-row gap-5 mb-6">
            <div className="text-center sm:border-r sm:border-white/10 sm:pr-6">
              <div className="text-4xl font-black text-white">{data.averageRating?.toFixed(1)}</div>
              <Stars value={data.averageRating ?? 0} size={16} />
              <div className="text-xs text-gray-400 mt-1">{data.reviewCount === 1 ? t('coaches.reviewCountOne', '{{count}} review', { count: data.reviewCount }) : t('coaches.reviewCountOther', '{{count}} reviews', { count: data.reviewCount })}</div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(star => {
                const count = data.distribution[String(star)] ?? 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-3">{star}</span>
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review cards */}
          <div className="space-y-3">
            {data.reviews.map(r => <ReviewCard key={r.id} review={r} slug={slug} isOwner={data.isOwner} />)}
          </div>
        </>
      )}

      <WriteReviewModal slug={slug} coachName={coachName} defaultSportId={sportId} isOpen={writeOpen} onClose={() => setWriteOpen(false)} />
    </div>
  );
}
