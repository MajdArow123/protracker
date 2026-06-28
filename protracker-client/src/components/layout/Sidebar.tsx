import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Shield,
  BarChart3,
  Activity,
  Salad,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
  {
    to: '/player-dashboard',
    label: 'My Dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  { to: '/player-dashboard/stats', label: 'My Stats', icon: Activity },
  { to: '/player-dashboard/nutrition', label: 'My Nutrition', icon: Salad },
  { to: '/player-dashboard/improvement', label: 'My Plan', icon: TrendingUp },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const nav = user?.role === 'Coach' ? coachNav : athleteNav;

  return (
    <div className="flex flex-col h-full bg-gray-900 dark:bg-gray-950 text-white w-64">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">ProTracker</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">Logged in as</div>
        <div className="text-sm font-medium text-gray-200 truncate">
          {user?.fullName}
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
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
