import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/useAuth';

// Standalone 404 shown for any unmatched route.
export function NotFoundPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const dashboardPath = user?.role === 'Athlete' ? '/player-dashboard' : user ? '/dashboard' : '/';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-center px-6">
      <div className="flex items-center gap-2.5 mb-10">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Activity size={19} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
      </div>

      <p className="text-7xl sm:text-8xl font-black gradient-text leading-none">404</p>
      <h1 className="mt-4 text-2xl font-black text-white">{t('ui.notFound', 'Page not found')}</h1>
      <p className="mt-2 text-sm text-gray-400 max-w-sm leading-relaxed">
        {t('ui.notFoundDesc', "The page you're looking for doesn't exist or has been moved.")}
      </p>

      <Link
        to={dashboardPath}
        className="mt-7 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
      >
        <ArrowLeft size={16} /> {t('nav.backToDashboard', 'Back to Dashboard')}
      </Link>

      {user?.role !== 'Athlete' && (
        <div className="mt-8 flex items-center gap-5 text-sm">
          <Link to="/dashboard" className="text-gray-400 hover:text-indigo-400 transition-colors">{t('nav.dashboard', 'Dashboard')}</Link>
          <Link to="/players" className="text-gray-400 hover:text-indigo-400 transition-colors">{t('nav.players', 'Players')}</Link>
          <Link to="/teams" className="text-gray-400 hover:text-indigo-400 transition-colors">{t('nav.teams', 'Teams')}</Link>
        </div>
      )}
    </div>
  );
}
