import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { CalendarDays, ChevronDown, ChevronUp, MapPin, Swords, Trophy } from 'lucide-react';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import { SourceBadge } from '../../ui/SourceBadge';
import { previousMeetings } from './matchContextLogic';
import type { MatchResult } from '../../../types';

interface Props {
  /** The match the board is keyed to. */
  match: MatchResult;
  /** The team's full match list — previous meetings are DERIVED from it. */
  allMatches: MatchResult[];
}

// Phase 7a match context on the lineup board. Honesty rules:
// - Facts (opponent, date, venue, competition, home/away, score) are recorded
//   match data. A Scheduled fixture shows "Upcoming" — never a score.
// - Previous meetings are derived from real Played matches only (pure
//   `previousMeetings`, vitest-pinned); zero history says so out loud.
// - The opponent plan is coach-entered preparation and wears the badge.
export function MatchContextPanel({ match, allMatches }: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const [collapsed, setCollapsed] = useState(false);

  const meetings = useMemo(
    () => previousMeetings(allMatches, match.opponentName, match.matchDate, match.id),
    [allMatches, match.opponentName, match.matchDate, match.id],
  );
  const upcoming = match.status === 'Scheduled';
  const shown = meetings.meetings.slice(0, 3);

  return (
    <div className="mb-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Swords size={14} className="text-indigo-400 flex-shrink-0" aria-hidden />
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {match.isHome ? t('matches.vs', 'vs') : t('matches.at', '@')} {match.opponentName}
          </span>
          {upcoming ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 flex-shrink-0">
              {t('matches.upcoming', 'Upcoming')}
            </span>
          ) : match.scoreDisplay ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 flex-shrink-0" dir="ltr">
              {match.scoreDisplay}
            </span>
          ) : null}
        </span>
        {collapsed ? <ChevronDown size={15} className="text-gray-400" aria-hidden /> : <ChevronUp size={15} className="text-gray-400" aria-hidden />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-3">
          {/* Recorded match facts */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} aria-hidden />
              {formatDate(match.matchDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {match.competition && (
              <span className="inline-flex items-center gap-1">
                <Trophy size={12} aria-hidden />
                {match.competition}
              </span>
            )}
            {match.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden />
                {match.venue}
              </span>
            )}
            <span className="font-semibold">
              {match.isHome ? t('matches.home', 'Home') : t('matches.away', 'Away')}
            </span>
          </div>

          {/* Previous meetings — derived from real played matches only */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {t('matches.previousMeetings', 'Previous meetings')}
            </p>
            {shown.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('matches.noPreviousMeetings', 'No previous meetings recorded against this opponent.')}
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                  {/* Manual One/Other keys — i18next _one/_other suffixes break for ar/he (pinned). */}
                  {meetings.meetings.length === 1
                    ? t('matches.meetingsRecordOne', '1 played — {{wins}}W · {{draws}}D · {{losses}}L', { ...meetings.record })
                    : t('matches.meetingsRecordOther', '{{count}} played — {{wins}}W · {{draws}}D · {{losses}}L', {
                        count: meetings.meetings.length,
                        ...meetings.record,
                      })}
                </p>
                <div className="space-y-1">
                  {shown.map(pm => (
                    <div key={pm.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={clsx(
                          'font-black tabular-nums w-12 text-center rounded-md py-0.5',
                          pm.result === 'Win' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                          pm.result === 'Draw' && 'bg-gray-500/10 text-gray-600 dark:text-gray-300',
                          pm.result === 'Loss' && 'bg-red-500/10 text-red-500',
                        )}
                        dir="ltr"
                      >
                        {pm.scoreDisplay}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatDate(pm.matchDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Opponent plan — coach preparation, never recorded fact */}
          {(match.opponentFormation || match.scoutingNotes) && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t('matches.opponentPlan', 'Opponent plan')}
                </span>
                <SourceBadge source="coach-entered" size="xs" />
              </div>
              {match.opponentFormation && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">{t('matches.opponentFormationLabel', 'Formation:')}</span>{' '}
                  <span dir="ltr">{match.opponentFormation}</span>
                </p>
              )}
              {match.scoutingNotes && (
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{match.scoutingNotes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
