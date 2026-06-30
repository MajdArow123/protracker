import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Shield, BarChart3, Activity, Salad,
  TrendingUp, X, LogOut, User, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTeams } from '../../hooks/useTeams';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const coachNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Teams', icon: Shield },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

const athleteNav: NavItem[] = [
  { to: '/player-dashboard', label: 'My Dashboard', icon: LayoutDashboard, end: true },
  { to: '/player-dashboard/stats', label: 'My Stats', icon: Activity },
  { to: '/player-dashboard/nutrition', label: 'My Nutrition', icon: Salad },
  { to: '/player-dashboard/improvement', label: 'My Plan', icon: TrendingUp },
];

const SPORT_COLORS: Record<string, string> = {
  Football: 'text-green-400',
  Basketball: 'text-orange-400',
  Volleyball: 'text-blue-400',
  'Beach Volleyball': 'text-yellow-400',
  Tennis: 'text-purple-400',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function CoachSportBadge() {
  const { data: teams = [] } = useTeams();
  if (teams.length === 0) return null;
  const sport = teams[0].sportName;
  const colorClass = SPORT_COLORS[sport] ?? 'text-indigo-400';
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10', colorClass)}>
      {sport}
    </span>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const nav = user?.role === 'Coach' ? coachNav : athleteNav;
  const profilePath = user?.role === 'Coach' ? '/profile' : '/player-dashboard/profile';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      addToast('Logged out successfully', 'success');
    } catch {
      addToast('Logout failed', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full w-64 bg-gray-900 dark:bg-[#0f1117] border-r border-gray-800 dark:border-gray-800/80">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={17} className="text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">ProTracker</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-gray-500 hover:text-white transition-colors cursor-pointer p-1"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          {user?.role === 'Coach' ? 'Management' : 'My Profile'}
        </p>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon size={17} />
                  {item.label}
                </div>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-gray-800 space-y-1">
        <NavLink
          to={profilePath}
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )
          }
        >
          <User size={17} />
          Profile & Settings
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-all cursor-pointer"
        >
          <LogOut size={17} />
          Sign Out
        </button>

        {/* User card */}
        <div className="mt-2 pt-3 border-t border-gray-800 flex items-center gap-3 px-2 py-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
            {user?.fullName ? getInitials(user.fullName) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-200 truncate">{user?.fullName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-gray-500">{user?.role}</p>
              {user?.role === 'Coach' && <CoachSportBadge />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: Props) {
  return (
    <>
      <aside className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">
        <SidebarContent onClose={onClose} />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 z-50 h-full lg:hidden"
            >
              <SidebarContent onClose={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export { SPORT_COLORS };
