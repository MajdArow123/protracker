import { PlayerAvatar } from '../../players/PlayerAvatar';
import type { Player } from '../../../types';

// The drag overlay: a lightweight card that follows the pointer. Positioned by
// useLineupDrag via direct transform writes on the inner element (rAF, no React
// re-render per move). Purely decorative — pointer-events-none, aria-hidden.
export function DragGhost({ player, ghostElRef }: {
  player: Player;
  ghostElRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" aria-hidden="true">
      <div ref={ghostElRef} className="absolute -top-8 -left-8 will-change-transform">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gray-900/90 text-white shadow-2xl ring-2 ring-indigo-400">
          <PlayerAvatar name={player.fullName} imageUrl={player.profileImageUrl} sportId={player.sportId} size={28} />
          <span className="text-xs font-bold pe-1 whitespace-nowrap">{player.fullName}</span>
        </div>
      </div>
    </div>
  );
}
