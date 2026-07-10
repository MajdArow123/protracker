import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Star, ChevronDown, MessageSquare, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { useSessionFeedbackAnalytics, useSessionFeedbackSummary } from '../../hooks/useSessionFeedback';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { RatedSessionPoint } from '../../types';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} className={clsx(n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')} />
      ))}
    </div>
  );
}

function ExpandedResponses({ sessionId }: { sessionId: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSessionFeedbackSummary(sessionId);
  if (isLoading) return <p className="text-xs text-gray-400 px-3 py-2">{t('sessions.loadingResponses', 'Loading responses…')}</p>;
  if (!data || data.responses.length === 0) return <p className="text-xs text-gray-400 px-3 py-2">{t('sessions.noResponses', 'No responses yet.')}</p>;

  return (
    <div className="px-3 py-2 space-y-2 bg-gray-50/60 dark:bg-gray-800/30 rounded-b-xl">
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-gray-500 pb-1">
        <div><span className="font-bold text-gray-900 dark:text-white">{data.averageRating?.toFixed(1) ?? '—'}</span> {t('sessions.avgRatingLabel', 'avg rating')}</div>
        <div><span className="font-bold text-gray-900 dark:text-white">{data.averageDifficulty?.toFixed(1) ?? '—'}</span> {t('sessions.difficultyStat', 'difficulty')}</div>
        <div><span className="font-bold text-gray-900 dark:text-white">{data.respondedCount}/{data.teamPlayerCount}</span> {t('sessions.ratedStat', 'rated')}</div>
      </div>
      {data.responses.map(r => (
        <div key={r.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">{r.playerName}</span>
            <Stars value={r.rating} size={12} />
          </div>
          <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
            <span>{t('sessions.energyStat', 'Energy {{before}}→{{after}}', { before: r.energyBefore, after: r.energyAfter })}</span>
            <span>{t('sessions.difficultyStat5', 'Difficulty {{value}}/5', { value: r.difficulty })}</span>
          </div>
          {r.whatWentWell && <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1"><span className="text-emerald-600">+</span> {r.whatWentWell}</p>}
          {r.whatWasHard && <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5"><span className="text-amber-600">△</span> {r.whatWasHard}</p>}
          {r.injuryNote && (
            <p className="flex items-start gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {r.injuryNote}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SessionRow({ point }: { point: RatedSessionPoint }) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (s: string) => formatDate(s, { month: 'short', day: 'numeric' });
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white truncate text-sm">{point.title}</span>
            {point.injuryFlagCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold">
                <AlertTriangle size={10} /> {point.injuryFlagCount}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {fmtDate(point.startTime)} · {L.sessionType(point.sessionType)} · {t('sessions.ratedCount', '{{count}} rated', { count: point.respondedCount })}
          </div>
        </div>
        <Stars value={point.averageRating} />
        <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">{point.averageRating.toFixed(1)}</span>
        <ChevronDown size={16} className={clsx('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <ExpandedResponses sessionId={point.scheduledSessionId} />}
    </div>
  );
}

export function CoachSessionFeedbackPanel({ teamId }: { teamId: number }) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { data: analytics } = useSessionFeedbackAnalytics(teamId);

  if (!analytics || analytics.totalResponses === 0) return null;

  const bestType = analytics.byType[0];
  // Most recent rated sessions first.
  const trend = [...analytics.ratingTrend].reverse();
  const maxTypeRating = Math.max(...analytics.byType.map(t => t.averageRating), 5);

  return (
    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-indigo-400" /> {tr('sessions.sessionFeedback', 'Session Feedback')}
      </h3>

      {/* Analytics summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><Star size={12} className="text-amber-500" /> {tr('sessions.avgRating', 'Avg rating')}</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{analytics.overallAverageRating?.toFixed(1) ?? '—'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><Activity size={12} className="text-sky-500" /> {tr('sessions.avgDifficulty', 'Avg difficulty')}</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{analytics.overallAverageDifficulty?.toFixed(1) ?? '—'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><TrendingUp size={12} className="text-emerald-500" /> {tr('sessions.bestType', 'Best type')}</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{bestType ? L.sessionType(bestType.sessionType) : '—'}</div>
        </div>
        <div className={clsx('rounded-xl border p-3', analytics.injuryFlagCount > 0 ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-800')}>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1"><AlertTriangle size={12} className="text-red-500" /> {tr('sessions.injuryFlags', 'Injury flags')}</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{analytics.injuryFlagCount}</div>
        </div>
      </div>

      {/* By session type */}
      {analytics.byType.length > 1 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-2">{tr('sessions.ratingByType', 'Rating by session type')}</p>
          <div className="space-y-1.5">
            {analytics.byType.map(t => (
              <div key={t.sessionType} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 w-20 flex-shrink-0">{L.sessionType(t.sessionType)}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(t.averageRating / maxTypeRating) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white w-8 text-right">{t.averageRating.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-session feedback */}
      <div className="space-y-2">
        {trend.map(point => <SessionRow key={point.scheduledSessionId} point={point} />)}
      </div>
    </div>
  );
}
