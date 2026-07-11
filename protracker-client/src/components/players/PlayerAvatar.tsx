import { clsx } from 'clsx';
import { sportGradient, sportNameById } from '../../utils/sportColors';

interface Props {
  name: string;
  imageUrl?: string | null;
  sportId?: number | null;
  /** Outer size in px (ring included). */
  size?: number;
  className?: string;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Avatar with a sport-gradient ring: photo when the athlete has one, initials
// otherwise. The ring color follows the player's sport, matching team heroes.
export function PlayerAvatar({ name, imageUrl, sportId, size = 44, className }: Props) {
  const gradient = sportGradient(sportNameById(sportId));
  const fontSize = Math.max(11, Math.round(size * 0.3));

  return (
    <div
      className={clsx('rounded-full bg-gradient-to-br p-[2.5px] flex-shrink-0', gradient, className)}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover border-2 border-white dark:border-gray-900"
        />
      ) : (
        <div
          className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center font-black text-gray-700 dark:text-gray-200"
          style={{ fontSize }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}
