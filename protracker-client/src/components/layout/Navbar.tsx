import { Menu, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';
import { useLocation, Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from './LanguageSwitcher';

// Path → [translation key, English fallback] for exact-match page titles.
const pageTitles: Record<string, [string, string]> = {
  '/dashboard': ['nav.dashboard', 'Dashboard'],
  '/teams': ['nav.teams', 'Teams'],
  '/players': ['nav.players', 'Players'],
  '/reports': ['nav.reports', 'Reports'],
  '/profile': ['nav.profileSettings', 'Profile & Settings'],
  '/player-dashboard': ['nav.myDashboard', 'My Dashboard'],
  '/player-dashboard/stats': ['nav.myStats', 'My Stats'],
  '/player-dashboard/nutrition': ['nav.myNutrition', 'My Nutrition'],
  '/player-dashboard/improvement': ['nav.myPlan', 'My Plan'],
  '/player-dashboard/profile': ['nav.myProfile', 'My Profile'],
  '/nutrition/food-alternatives': ['nav.foodAlternatives', 'Food Alternatives'],
};

function getTitle(pathname: string, t: TFunction): string {
  const exact = pageTitles[pathname];
  if (exact) return t(exact[0], exact[1]);
  if (pathname.startsWith('/players/') && pathname.endsWith('/assessment')) return t('nav.assessment', 'Assessment');
  if (pathname.startsWith('/players/') && pathname.endsWith('/improvement-plan')) return t('nav.improvementPlan', 'Improvement Plan');
  if (pathname.startsWith('/players/') && pathname.endsWith('/nutrition')) return t('nav.nutrition', 'Nutrition');
  if (pathname.startsWith('/players/') && pathname.endsWith('/edit')) return t('nav.editPlayer', 'Edit Player');
  if (pathname.startsWith('/players/new')) return t('nav.newPlayer', 'New Player');
  if (pathname.startsWith('/players/')) return t('nav.playerProfile', 'Player Profile');
  if (pathname.startsWith('/teams/') && pathname.endsWith('/edit')) return t('nav.editTeam', 'Edit Team');
  if (pathname.startsWith('/teams/new')) return t('nav.newTeam', 'New Team');
  if (pathname.startsWith('/teams/')) return t('nav.team', 'Team');
  if (pathname.startsWith('/reports/')) return t('nav.report', 'Report');
  return 'ProTracker';
}

interface Props {
  onMenuClick: () => void;
  /** Desktop (lg+) sidebar collapse — the mobile hamburger above is untouched. */
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Navbar({ onMenuClick, sidebarCollapsed, onToggleCollapse }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const title = getTitle(location.pathname, t);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 h-14 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
        aria-label={t('common.openMenu', 'Open menu')}
      >
        <Menu size={20} />
      </button>

      {/* Desktop-only collapse/expand for the always-on sidebar. The panel icons are
          mirrored in rtl.css so they point at the sidebar's actual edge in ar/he. */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:inline-flex text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
        aria-label={sidebarCollapsed ? t('nav.expandSidebar', 'Expand sidebar') : t('nav.collapseSidebar', 'Collapse sidebar')}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      <h1 className="text-base font-semibold text-gray-900 dark:text-white flex-1">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          onClick={toggle}
          className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          aria-label={t('common.toggleTheme', 'Toggle theme')}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NotificationBell />

        {user && (
          <Link
            to={user.role === 'Coach' ? '/profile' : user.role === 'SoloAthlete' ? '/solo/profile' : '/player-dashboard/profile'}
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
                {user.role === 'SoloAthlete' ? t('common.soloAthlete', 'Solo Athlete') : user.role}
              </Badge>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
