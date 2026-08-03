import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Activity, Search, SlidersHorizontal, X, Users, ArrowRight } from 'lucide-react';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useSports } from '../../hooks/useSports';
import { useAuth } from '../../context/useAuth';
import { useCoachMarketplaceInfinite } from '../../hooks/useCoachMarketplace';
import { CoachCard } from '../../components/coaches/CoachCard';
import { Spinner } from '../../components/ui/Spinner';

const YEAR_BUCKETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any' },
  { label: '1–3 yrs', min: 1, max: 3 },
  { label: '3–5 yrs', min: 3, max: 5 },
  { label: '5–10 yrs', min: 5, max: 10 },
  { label: '10+ yrs', min: 10 },
];

export function CoachMarketplacePage() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { user } = useAuth();
  const { data: sports = [] } = useSports();
  const [params, setParams] = useSearchParams();

  const initialSport = params.get('sport') ? Number(params.get('sport')) : null;
  const [sport, setSport] = useState<number | null>(initialSport);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [yearIdx, setYearIdx] = useState(0);
  const [sort, setSort] = useState<'default' | 'rated'>('default');
  const [mobileFilters, setMobileFilters] = useState(false);

  const bucket = YEAR_BUCKETS[yearIdx];
  const filters = useMemo(() => ({
    sport, search: search.trim() || undefined, city: city.trim() || undefined,
    country: country.trim() || undefined, accepting: accepting || undefined,
    minYears: bucket.min ?? null, maxYears: bucket.max ?? null,
    sort: sort === 'rated' ? 'rated' : undefined,
  }), [sort, sport, search, city, country, accepting, bucket]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useCoachMarketplaceInfinite(filters);

  const items = data?.pages.flatMap(p => p.items) ?? [];
  const total = data?.pages[0]?.totalCount ?? 0;

  const pickSport = (id: number | null) => {
    setSport(id);
    const next = new URLSearchParams(params);
    if (id) next.set('sport', String(id)); else next.delete('sport');
    setParams(next, { replace: true });
  };

  const resetFilters = () => {
    setSearch(''); setCity(''); setCountry(''); setAccepting(false); setYearIdx(0);
  };

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('coaches.filterSearch', 'Search')}</label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('coaches.searchPlaceholder', 'Name or specialization')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('coaches.filterLocation', 'Location')}</label>
        <div className="space-y-2">
          <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('coaches.cityPlaceholder', 'City')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input value={country} onChange={e => setCountry(e.target.value)} placeholder={t('coaches.countryPlaceholder', 'Country')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t('coaches.filterExperience', 'Experience')}</label>
        <div className="flex flex-wrap gap-1.5">
          {YEAR_BUCKETS.map((b, i) => (
            <button
              key={b.label}
              onClick={() => setYearIdx(i)}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors',
                i === yearIdx ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200')}
            >
              {i === 0 ? t('coaches.expAny', 'Any') : b.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button" role="switch" aria-checked={accepting}
          onClick={() => setAccepting(a => !a)}
          className={clsx('relative flex-shrink-0 w-11 h-6 rounded-full transition-colors', accepting ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600')}
        >
          <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', accepting && 'translate-x-5')} />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">{t('coaches.acceptingOnly', 'Accepting athletes only')}</span>
      </label>

      <button onClick={resetFilters} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
        {t('coaches.clearFilters', 'Clear filters')}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0d13]">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center"><Activity size={17} className="text-white" /></div>
            <span className="text-base font-bold text-gray-900 dark:text-white">ProTracker</span>
          </Link>
          <Link
            to={user ? (user.role === 'Coach' ? '/dashboard' : '/') : '/login'}
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {user ? t('coaches.goToApp', 'Go to app') : t('coaches.signIn', 'Sign in')}
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-black">{t('coaches.heroTitle', 'Find your perfect sports coach')}</h1>
          <p className="text-indigo-100 mt-3 max-w-2xl">
            {t('coaches.heroSubtitle', 'Browse verified coaches across 5 sports. Find someone who matches your goals and schedule.')}
          </p>
          {/* Sport pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            <SportPill active={sport == null} onClick={() => pickSport(null)}>{t('coaches.allSports', 'All Sports')}</SportPill>
            {sports.map(s => (
              <SportPill key={s.id} active={sport === s.id} onClick={() => pickSport(s.id)}>{dyn.sport(s.name)}</SportPill>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Mobile filter trigger */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} {total === 1 ? t('coaches.coachSingular', 'coach') : t('coaches.coachPlural', 'coaches')}</p>
          <button onClick={() => setMobileFilters(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold cursor-pointer">
            <SlidersHorizontal size={15} /> {t('coaches.filters', 'Filters')}
          </button>
        </div>

        <div className="flex gap-6">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-20 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              {filterPanel}
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="hidden lg:flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isLoading
                  ? t('coaches.loading', 'Loading…')
                  : t('coaches.showingOf', 'Showing {{shown}} of {{total}} {{noun}}', {
                      shown: items.length,
                      total,
                      noun: total === 1 ? t('coaches.coachSingular', 'coach') : t('coaches.coachPlural', 'coaches'),
                    })}
              </p>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as 'default' | 'rated')}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="default">{t('coaches.sortRecommended', 'Recommended')}</option>
                <option value="rated">{t('coaches.sortHighestRated', 'Highest rated')}</option>
              </select>
            </div>

            {isLoading ? (
              <div className="py-20 flex justify-center"><Spinner /></div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-16 px-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Users size={22} className="text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">{t('coaches.noCoachesFound', 'No coaches found')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('coaches.noCoachesHint', 'Try adjusting your filters or check back later.')}</p>
                <Link to="/login" className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  {t('coaches.areYouCoach', 'Are you a coach? Create your profile')} <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(c => <CoachCard key={c.slug} coach={c} />)}
                </div>
                {hasNextPage && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
                    >
                      {isFetchingNextPage ? t('coaches.loading', 'Loading…') : t('coaches.loadMore', 'Load more')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {mobileFilters && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-white dark:bg-gray-900 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('coaches.filters', 'Filters')}</h3>
              <button onClick={() => setMobileFilters(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"><X size={18} /></button>
            </div>
            {filterPanel}
            <button onClick={() => setMobileFilters(false)} className="w-full mt-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer">
              {t('coaches.showCount', 'Show {{total}} {{noun}}', { total, noun: total === 1 ? t('coaches.coachSingular', 'coach') : t('coaches.coachPlural', 'coaches') })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SportPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx('px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer',
        active ? 'bg-white text-indigo-700 shadow' : 'bg-white/15 text-white hover:bg-white/25')}
    >
      {children}
    </button>
  );
}
