import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Plus, Trophy, Search } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useSports } from '../../hooks/useSports';
import { useLeagues, useMyLeagues } from '../../hooks/useLeagues';
import { LeagueCard } from '../../components/leagues/LeagueCard';
import { CreateLeagueModal } from '../../components/leagues/CreateLeagueModal';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

type Tab = 'mine' | 'browse';

export function LeaguesPage() {
  const navigate = useNavigate();
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const { data: sports = [] } = useSports();

  const [tab, setTab] = useState<Tab>('mine');
  const [sport, setSport] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: mine = [], isLoading: loadingMine } = useMyLeagues(tab === 'mine');
  const { data: browse = [], isLoading: loadingBrowse } = useLeagues(
    { sport, search: search.trim() || undefined }, tab === 'browse');

  const isLoading = tab === 'mine' ? loadingMine : loadingBrowse;
  const leagues = tab === 'mine' ? mine : browse;

  const actions = isCoach ? (
    <button onClick={() => setCreateOpen(true)}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
      <Plus size={15} /> {tr('leagues.createLeague', 'Create League')}
    </button>
  ) : undefined;

  return (
    <PageWrapper title={tr('leagues.title', 'Leagues')} actions={actions}>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['mine', 'browse'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer',
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>
            {t === 'mine' ? tr('leagues.myLeagues', 'My Leagues') : tr('leagues.browseLeagues', 'Browse Leagues')}
          </button>
        ))}
      </div>

      {/* Browse filters */}
      {tab === 'browse' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('leagues.searchLeagues', 'Search leagues')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSport(null)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer',
                sport == null ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>{tr('common.all', 'All')}</button>
            {sports.map(s => (
              <button key={s.id} onClick={() => setSport(s.id)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer',
                  sport === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')}>{L.sport(s.name)}</button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : leagues.length === 0 ? (
        <EmptyState
          icon={<Trophy size={30} />}
          title={tab === 'mine' ? tr('leagues.noLeagues', 'No leagues yet') : tr('leagues.noPublicLeagues', 'No public leagues found')}
          description={tab === 'mine'
            ? (isCoach ? tr('leagues.noLeaguesCoachDesc', 'Create a league or register a team in one to see it here.') : tr('leagues.noLeaguesAthleteDesc', "Your team isn't in any leagues yet."))
            : tr('leagues.noPublicLeaguesDesc', 'Try a different sport or search, or check back later.')}
          action={tab === 'mine' && isCoach ? { label: tr('leagues.createLeague', 'Create League'), onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map(l => <LeagueCard key={l.id} league={l} />)}
        </div>
      )}

      <CreateLeagueModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={id => navigate(`/leagues/${id}`)} />
    </PageWrapper>
  );
}
