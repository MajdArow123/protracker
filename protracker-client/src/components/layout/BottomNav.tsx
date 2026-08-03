import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Home, Users, Shield, CheckSquare, MessageSquare, TrendingUp, Salad, Heart, Dumbbell, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/useAuth';
import { useUnreadMessageCount } from '../../hooks/useMessages';

interface Item {
  to: string;
  label: string;
  labelKey: string;
  icon: typeof Home;
  end?: boolean;
  badge?: 'messages';
}

const coachItems: Item[] = [
  { to: '/dashboard', label: 'Home', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/players', label: 'Players', labelKey: 'nav.players', icon: Users },
  { to: '/teams', label: 'Teams', labelKey: 'nav.teams', icon: Shield },
  { to: '/tasks', label: 'Tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/messages', label: 'Chat', labelKey: 'nav.chat', icon: MessageSquare, badge: 'messages' },
];

const athleteItems: Item[] = [
  { to: '/player-dashboard', label: 'Home', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/player-dashboard/stats', label: 'Stats', labelKey: 'nav.stats', icon: TrendingUp },
  { to: '/player-dashboard/tasks', label: 'Tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/messages', label: 'Chat', labelKey: 'nav.chat', icon: MessageSquare, badge: 'messages' },
  { to: '/player-dashboard/nutrition', label: 'Nutrition', labelKey: 'nav.nutrition', icon: Salad },
];

const soloItems: Item[] = [
  { to: '/solo-dashboard', label: 'Home', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/solo/performance', label: 'Performance', labelKey: 'nav.performance', icon: TrendingUp },
  { to: '/solo/nutrition', label: 'Nutrition', labelKey: 'nav.nutrition', icon: Salad },
  { to: '/solo/training', label: 'Training', labelKey: 'nav.training', icon: Dumbbell },
  { to: '/solo/profile', label: 'Profile', labelKey: 'nav.profile', icon: User },
];

const parentItems: Item[] = [
  { to: '/parent-dashboard', label: 'My Children', labelKey: 'nav.myChildren', icon: Heart, end: true },
];

// Fixed bottom tab bar shown only on phones (< md). Replaces the sidebar for primary
// navigation; the hamburger drawer remains for overflow items (Reports, Profile, etc.).
export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: unread = 0 } = useUnreadMessageCount();
  if (!user) return null;
  const items = user.role === 'Coach' ? coachItems : user.role === 'Parent' ? parentItems : user.role === 'SoloAthlete' ? soloItems : athleteItems;

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
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="bottomnav-active"
                  className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-indigo-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
          <span className={clsx('relative transition-transform duration-150', isActive && 'scale-110 -translate-y-0.5')}>
            <item.icon size={20} />
            {item.badge === 'messages' && unread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span>{t(item.labelKey, item.label)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
