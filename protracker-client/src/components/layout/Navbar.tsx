import { Menu, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLocation, Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/teams': 'Teams',
  '/players': 'Players',
  '/reports': 'Reports',
  '/profile': 'Profile & Settings',
  '/player-dashboard': 'My Dashboard',
  '/player-dashboard/stats': 'My Stats',
  '/player-dashboard/nutrition': 'My Nutrition',
  '/player-dashboard/improvement': 'My Plan',
  '/player-dashboard/profile': 'My Profile',
  '/nutrition/food-alternatives': 'Food Alternatives',
};

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/players/') && pathname.endsWith('/assessment')) return 'Assessment';
  if (pathname.startsWith('/players/') && pathname.endsWith('/improvement-plan')) return 'Improvement Plan';
  if (pathname.startsWith('/players/') && pathname.endsWith('/nutrition')) return 'Nutrition';
  if (pathname.startsWith('/players/') && pathname.endsWith('/edit')) return 'Edit Player';
  if (pathname.startsWith('/players/new')) return 'New Player';
  if (pathname.startsWith('/players/')) return 'Player Profile';
  if (pathname.startsWith('/teams/') && pathname.endsWith('/edit')) return 'Edit Team';
  if (pathname.startsWith('/teams/new')) return 'New Team';
  if (pathname.startsWith('/teams/')) return 'Team';
  if (pathname.startsWith('/reports/')) return 'Report';
  return 'ProTracker';
}

interface Props {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: Props) {
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const title = getTitle(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 h-14 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-base font-semibold text-gray-900 dark:text-white flex-1">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {user && (
          <Link
            to={user.role === 'Coach' ? '/profile' : '/player-dashboard/profile'}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
              {user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-none">
                {user.fullName}
              </p>
              <Badge
                variant={user.role === 'Coach' ? 'info' : 'success'}
                className="mt-0.5 text-[10px]"
              >
                {user.role}
              </Badge>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
