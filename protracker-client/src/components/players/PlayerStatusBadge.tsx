import { clsx } from 'clsx';
import type { PlayerStatus } from '../../types';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

export const STATUS_STYLES: Record<PlayerStatus, string> = {
  Active: 'bg-green-500/15 text-green-500 border border-green-500/30',
  Injured: 'bg-red-500/15 text-red-500 border border-red-500/30',
  Suspended: 'bg-amber-500/15 text-amber-500 border border-amber-500/30',
  Inactive: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
};

// Coach-set roster status. On list cards pass hideActive so the common case stays quiet;
// detail pages show it always.
export function PlayerStatusBadge({ status, hideActive = false, size = 'xs' }: {
  status?: PlayerStatus | null;
  hideActive?: boolean;
  size?: 'xs' | 'sm';
}) {
  const L = useDynamicLabels();
  const s: PlayerStatus = status ?? 'Active';
  if (hideActive && s === 'Active') return null;
  return (
    <span className={clsx(
      'rounded-full font-semibold flex-shrink-0',
      size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      STATUS_STYLES[s],
    )}>
      {L.status(s)}
    </span>
  );
}
