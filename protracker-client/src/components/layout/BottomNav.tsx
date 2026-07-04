import { NavLink } from 'react-router-dom';
import { Home, Users, Shield, CheckSquare, MessageSquare, TrendingUp, Salad } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessageCount } from '../../hooks/useMessages';

interface Item {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  badge?: 'messages';
}

const coachItems: Item[] = [
  { to: '/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/teams', label: 'Teams', icon: Shield },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/messages', label: 'Chat', icon: MessageSquare, badge: 'messages' },
];

const athleteItems: Item[] = [
  { to: '/player-dashboard', label: 'Home', icon: Home, end: true },
  { to: '/player-dashboard/stats', label: 'Stats', icon: TrendingUp },
  { to: '/player-dashboard/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/messages', label: 'Chat', icon: MessageSquare, badge: 'messages' },
  { to: '/player-dashboard/nutrition', label: 'Nutrition', icon: Salad },
];

// Fixed bottom tab bar shown only on phones (< md). Replaces the sidebar for primary
// navigation; the hamburger drawer remains for overflow items (Reports, Profile, etc.).
export function BottomNav() {
  const { user } = useAuth();
  const { data: unread = 0 } = useUnreadMessageCount();
  if (!user) return null;
  const items = user.role === 'Coach' ? coachItems : athleteItems;

  return (
    <nav className="md:hidden flex-shrink-0 flex items-stretch border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-[10px] font-semibold transition-colors',
              isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500',
            )
          }
        >
          <span className="relative">
            <item.icon size={20} />
            {item.badge === 'messages' && unread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
