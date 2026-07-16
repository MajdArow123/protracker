import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { scoreTone, SCORE_TONE_HEX } from '../../charts/chartColors';
import { confidenceBadgeClass, confidenceLabel } from '../../evidence/evidenceUtils';
import { SourceBadge } from '../../ui/SourceBadge';
import { RatingChip } from './LineupPlayerCard';
import type { CategoryStat, RatingState } from './lineupLogic';
import type { Player } from '../../../types';

interface Props {
  player: Player;
  rating: RatingState;
  breakdown: CategoryStat[];
  injured: boolean;
  onViewProfile: () => void;
  /** Shown on mobile where the card tap opens this panel instead of navigating. */
  showProfileButton: boolean;
}

// Popover/sheet body: the per-sport stat panel with the same confidence
// treatment as the rating — absent categories stay "—", Low-confidence bars
// render muted. Text direction follows the locale (the caller sets dir).
export function StatPopover({ player, rating, breakdown, injured, onViewProfile, showProfileButton }: Props) {
  const { t } = useTranslation();

  return (
    <div className="w-full text-start">
      <div className="flex items-center gap-2.5 mb-2">
        <PlayerAvatar name={player.fullName} imageUrl={player.profileImageUrl} sportId={player.sportId} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {player.jerseyNumber != null && <span className="text-indigo-500 me-1">#{player.jerseyNumber}</span>}
            {player.fullName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{player.positionName}</p>
        </div>
        <RatingChip rating={rating} className="text-sm px-2 py-1" />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2 text-[11px]">
        {rating.kind !== 'none' && (
          <>
            <SourceBadge
              source="calculated"
              size="xs"
              title={t('common.dataSource.calculatedFromEvidence', 'Calculated · from evidence scores')}
            />
            <span className={clsx('px-1.5 py-0.5 rounded-full font-semibold', confidenceBadgeClass(rating.confidence))}>
              {confidenceLabel(rating.confidence, t)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {t('teams.lineupMetricsScored', '{{count}} metrics scored', { count: rating.scoredMetrics })}
            </span>
          </>
        )}
        {rating.kind === 'thin' && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">{t('teams.lineupThinData', 'Thin data — treat with caution')}</span>
        )}
        {rating.kind === 'none' && (
          <span className="text-gray-500 dark:text-gray-400">{t('teams.lineupNoData', 'No data')}</span>
        )}
        {injured && (
          <span className="flex items-center gap-1 text-red-500 font-medium">
            <AlertTriangle size={11} /> {t('teams.lineupInjured', 'Injured')}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {breakdown.map(stat => {
          const muted = stat.value == null || stat.confidence === 'Low';
          return (
            <div key={stat.category} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">
                {t(`evidence.metricCategory${stat.category}`, stat.category)}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" dir="ltr">
                {stat.value != null && (
                  <div
                    className={clsx('h-full rounded-full', muted && 'opacity-40')}
                    style={{ width: `${stat.value * 10}%`, background: muted ? '#9ca3af' : SCORE_TONE_HEX[scoreTone(stat.value)] }}
                  />
                )}
              </div>
              <span className={clsx('text-[11px] font-semibold w-7 text-end', muted ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200')}>
                {stat.value != null ? stat.value.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {showProfileButton && (
        <button
          type="button"
          onClick={onViewProfile}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <ExternalLink size={12} /> {t('teams.lineupViewProfile', 'View evidence profile')}
        </button>
      )}
    </div>
  );
}
