import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/teams': 'Teams',
  '/players': 'Players',
  '/reports': 'Reports',
  '/player-dashboard': 'My Dashboard',
  '/player-dashboard/stats': 'My Stats',
  '/player-dashboard/nutrition': 'My Nutrition',
  '/player-dashboard/improvement': 'My Plan',
};

interface Props {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const title =
    Object.entries(pageTitles).find(
      ([path]) =>
        location.pathname === path ||
        location.pathname.startsWith(path + '/')
    )?.[1] ?? 'ProTracker';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      addToast('Logged out successfully', 'success');
    } catch {
      addToast('Logout failed', 'error');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <Menu size={22} />
      </button>
      <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex-1">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <Avatar name={user.fullName} size="sm" />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">
                {user.fullName}
              </p>
              <Badge
                variant={user.role === 'Coach' ? 'info' : 'success'}
                className="mt-0.5"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
