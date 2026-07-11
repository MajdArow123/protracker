import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Shield, BarChart3, Activity, Salad,
  TrendingUp, X, LogOut, User, ChevronRight, CheckSquare, MessageSquare, Heart, CreditCard,
  ClipboardList, Dumbbell, Trophy, Target, BookOpen, Library, NotebookPen, Handshake, Medal, Bell,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTeams } from '../../hooks/useTeams';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';
import { useUnreadMessageCount } from '../../hooks/useMessages';
import { useProfile } from '../../hooks/useProfile';
import { useIsRtl } from '../../hooks/useIsRtl';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  label: string;
  labelKey: string; // i18n key; falls back to `label` if missing
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const coachNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Teams', labelKey: 'nav.teams', icon: Shield },
  { to: '/players', label: 'Players', labelKey: 'nav.players', icon: Users },
  { to: '/goals', label: 'Player Goals', labelKey: 'nav.playerGoals', icon: Target },
  { to: '/tasks', label: 'Tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/drills', label: 'Drill Library', labelKey: 'nav.drillLibrary', icon: Library },
  { to: '/messages', label: 'Messages', labelKey: 'nav.messages', icon: MessageSquare },
  { to: '/notifications', label: 'Notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/leagues', label: 'Leagues', labelKey: 'nav.leagues', icon: Trophy },
  { to: '/coach/connection-requests', label: 'Requests', labelKey: 'nav.requests', icon: Handshake },
  { to: '/reports', label: 'Reports', labelKey: 'nav.reports', icon: BarChart3 },
  { to: '/settings/billing', label: 'Billing', labelKey: 'nav.billing', icon: CreditCard },
];

const athleteNav: NavItem[] = [
  { to: '/player-dashboard', label: 'My Dashboard', labelKey: 'nav.myDashboard', icon: LayoutDashboard, end: true },
  { to: '/player-dashboard/stats', label: 'My Stats', labelKey: 'nav.myStats', icon: Activity },
  { to: '/player-dashboard/goals', label: 'My Goals', labelKey: 'goals.title', icon: Target },
  { to: '/player-dashboard/journal', label: 'Journal', labelKey: 'nav.journal', icon: BookOpen },
  { to: '/player-dashboard/notes', label: 'My Notes', labelKey: 'nav.notes', icon: NotebookPen },
  { to: '/player-dashboard/drills', label: 'Drill Library', labelKey: 'nav.drillLibrary', icon: Library },
  { to: '/player-dashboard/tasks', label: 'My Tasks', labelKey: 'nav.myTasks', icon: CheckSquare },
  { to: '/messages', label: 'Messages', labelKey: 'nav.messages', icon: MessageSquare },
  { to: '/notifications', label: 'Notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/leagues', label: 'Leagues', labelKey: 'nav.leagues', icon: Trophy },
  { to: '/player-dashboard/nutrition', label: 'My Nutrition', labelKey: 'nav.myNutrition', icon: Salad },
  { to: '/player-dashboard/improvement', label: 'My Plan', labelKey: 'nav.myPlan', icon: TrendingUp },
];

// Self-improvement wording, not team management — the solo athlete runs their own show.
const soloNav: NavItem[] = [
  { to: '/solo-dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/solo/performance', label: 'My Performance', labelKey: 'nav.myPerformance', icon: TrendingUp },
  { to: '/solo/goals', label: 'Goals', labelKey: 'nav.goals', icon: Target },
  { to: '/solo/journal', label: 'Journal', labelKey: 'nav.journal', icon: BookOpen },
  { to: '/solo/notes', label: 'My Notes', labelKey: 'nav.notes', icon: NotebookPen },
  { to: '/solo/drills', label: 'Drill Library', labelKey: 'nav.drillLibrary', icon: Library },
  { to: '/solo/assessment', label: 'Assessments', labelKey: 'nav.assessments', icon: ClipboardList },
  { to: '/solo/nutrition', label: 'Nutrition', labelKey: 'nav.nutrition', icon: Salad },
  { to: '/solo/training', label: 'Training', labelKey: 'nav.training', icon: Dumbbell },
  { to: '/solo/matches', label: 'Matches', labelKey: 'nav.matches', icon: Trophy },
  { to: '/solo/recovery', label: 'Recovery', labelKey: 'nav.recovery', icon: Heart },
  { to: '/solo/tasks', label: 'Tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/notifications', label: 'Notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/leagues', label: 'Leagues', labelKey: 'nav.leagues', icon: Medal },
];

const parentNav: NavItem[] = [
  { to: '/parent-dashboard', label: 'My Children', labelKey: 'nav.myChildren', icon: Heart, end: true },
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
  const { t } = useTranslation();
  const nav = user?.role === 'Coach' ? coachNav : user?.role === 'Parent' ? parentNav : user?.role === 'SoloAthlete' ? soloNav : athleteNav;
  const profilePath = user?.role === 'Coach' ? '/profile' : user?.role === 'Parent' ? '/parent-dashboard' : user?.role === 'SoloAthlete' ? '/solo/profile' : '/player-dashboard/profile';
  const { data: unreadNotifs = 0 } = useUnreadNotificationCount();
  const { data: unreadMessages = 0 } = useUnreadMessageCount();
  const { data: profile } = useProfile();
  const navBadge = (to: string) => to === '/messages' ? unreadMessages : to === '/notifications' ? unreadNotifs : 0;

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
    <div className="flex flex-col h-full w-64 bg-gray-900 dark:bg-[#0f1117] border-e border-gray-800 dark:border-gray-800/80">
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
          {user?.role === 'Coach' ? t('nav.sectionManagement', 'Management')
            : user?.role === 'Parent' ? t('nav.sectionFamily', 'Family')
            : user?.role === 'SoloAthlete' ? t('nav.soloTraining', 'Solo Training')
            : t('nav.sectionMyProfile', 'My Profile')}
        </p>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive ? 'text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Sliding active background — shared layoutId animates it between items. */}
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <item.icon size={17} className="transition-transform duration-150 group-hover:scale-110" />
                  {t(item.labelKey, item.label)}
                </div>
                <div className="relative z-10 flex items-center gap-1.5">
                  {navBadge(item.to) > 0 && (
                    <span className={clsx(
                      'min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold',
                      isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white',
                    )}>
                      {navBadge(item.to) > 9 ? '9+' : navBadge(item.to)}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} className="opacity-60" />}
                </div>
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
          {t('nav.profile', 'Profile & Settings')}
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-all cursor-pointer"
        >
          <LogOut size={17} />
          {t('nav.signOut', 'Sign Out')}
        </button>

        {/* User card */}
        <div className="mt-2 pt-3 border-t border-gray-800 flex items-center gap-3 px-2 py-2">
          {profile?.profilePictureUrl ? (
            <img src={profile.profilePictureUrl} alt={user?.fullName ?? 'You'} className="flex-shrink-0 w-8 h-8 rounded-full object-cover border border-indigo-500/30" />
          ) : (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
              {user?.fullName ? getInitials(user.fullName) : '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-200 truncate">{user?.fullName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-gray-500">{user?.role === 'SoloAthlete' ? 'Solo Athlete' : user?.role}</p>
              {user?.role === 'Coach' && <CoachSportBadge />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: Props) {
  const rtl = useIsRtl();
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
              initial={{ x: rtl ? 264 : -264 }}
              animate={{ x: 0 }}
              exit={{ x: rtl ? 264 : -264 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 z-50 h-full lg:hidden start-0"
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
