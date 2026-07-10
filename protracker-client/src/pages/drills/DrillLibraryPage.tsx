import { useState, useMemo, useEffect } from 'react';
import { Library, Plus, Search, Heart, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { clsx } from 'clsx';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { DrillCard } from '../../components/drills/DrillCard';
import { DrillDetailModal } from '../../components/drills/DrillDetailModal';
import { AssignDrillModal } from '../../components/drills/AssignDrillModal';
import { CreateDrillModal } from '../../components/drills/CreateDrillModal';
import { RecommendedDrillsSection } from '../../components/drills/RecommendedDrillsSection';
import {
  CATEGORY_ORDER, DIFFICULTY_ORDER, CATEGORY_LABEL, CATEGORY_BADGE, DIFFICULTY_BADGE, SPORT_SHORT,
  matchesDuration, type DurationFilter,
} from '../../components/drills/drillUtils';
import { useDrills } from '../../hooks/useDrills';
import { useSports } from '../../hooks/useSports';
import { usePlayers, useMyPlayer } from '../../hooks/usePlayers';
import { useTeams } from '../../hooks/useTeams';
import { useAuth } from '../../context/AuthContext';
import type { Drill, DrillCategory, DrillDifficulty } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

const PAGE_SIZE = 12;
const DURATIONS: { value: DurationFilter; key: string; label: string }[] = [
  { value: 'any', key: 'drills.durAny', label: 'Any' }, { value: 'under10', key: 'drills.durUnder10', label: 'Under 10 min' },
  { value: '10to20', key: 'drills.dur10to20', label: '10–20 min' }, { value: 'over20', key: 'drills.durOver20', label: '20+ min' },
];

export function DrillLibraryPage() {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const isSolo = user?.role === 'SoloAthlete';
  const canManage = isCoach || isSolo;

  const { data: sports = [] } = useSports();
  const { data: coachTeams = [] } = useTeams(isCoach);
  const { data: myPlayer } = useMyPlayer(!isCoach);
  const { data: players = [] } = usePlayers(isCoach);

  const isAdmin = user?.role === 'Admin';

  // Sport scoping: a coach only ever sees their team sport; solo / team athletes only their
  // own sport. Sport pills (and the ability to switch) appear only for an admin or the edge-
  // case coach whose teams span multiple sports.
  const coachSports = useMemo(() => [...new Set(coachTeams.map(t => t.sportId))], [coachTeams]);
  const showSportPills = isAdmin || (isCoach && coachSports.length !== 1);
  const lockedSportId = showSportPills ? undefined : (isCoach ? coachSports[0] : myPlayer?.sportId);
  const defaultSportId = isCoach ? coachSports[0] : myPlayer?.sportId;

  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [sportId, setSportId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Set<DrillCategory>>(new Set());
  const [difficulty, setDifficulty] = useState<DrillDifficulty | null>(null);
  const [duration, setDuration] = useState<DurationFilter>('any');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Multi-sport/admin: default the pill selection to the user's first sport once known.
  useEffect(() => {
    if (showSportPills && defaultSportId) setSportId(defaultSportId);
  }, [showSportPills, defaultSportId]);

  // The sport actually applied: locked users can never leave their sport.
  const effectiveSportId = showSportPills ? sportId : (lockedSportId ?? null);
  // Wait until the locked sport is known before querying, so no other-sport drills flash in.
  const sportReady = showSportPills || lockedSportId != null;

  // Server-side: sport / search / favorited / mine (fetch all matching, refine client-side).
  const { data, isLoading, isError, refetch } = useDrills({
    sport: effectiveSportId, search: search.trim() || undefined,
    favorited: favoritesOnly, mine: tab === 'mine', pageSize: 200,
  }, sportReady);
  const allDrills = data?.items ?? [];

  const filtered = useMemo(() => allDrills.filter(d =>
    (categories.size === 0 || categories.has(d.category)) &&
    (!difficulty || d.difficulty === difficulty) &&
    matchesDuration(d.durationMinutes, duration),
  ), [allDrills, categories, difficulty, duration]);

  useEffect(() => { setPage(1); }, [effectiveSportId, search, tab, favoritesOnly, difficulty, duration, categories]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [detail, setDetail] = useState<Drill | null>(null);
  const [assigning, setAssigning] = useState<Drill | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Drill | null>(null);

  function toggleCategory(c: DrillCategory) {
    setCategories(prev => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  }
  const clearFilters = () => { setCategories(new Set()); setDifficulty(null); setDuration('any'); setFavoritesOnly(false); };
  const hasFilters = categories.size > 0 || difficulty || duration !== 'any' || favoritesOnly;

  const actions = canManage ? (
    <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
      <Plus size={16} className="mr-1.5" /> {tr('drills.createDrill', 'Create Drill')}
    </Button>
  ) : undefined;

  return (
    <PageWrapper title={tr('drills.title', 'Drill Library')} actions={actions}>
      {/* Recommended for you / for a player */}
      <RecommendedDrillsSection
        isCoach={isCoach}
        canAssign={canManage}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        lockedPlayerId={isCoach ? undefined : myPlayer?.id}
      />

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {canManage && (
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {(['all', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
                  tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                {t === 'all' ? tr('drills.allDrills', 'All Drills') : tr('drills.myDrills', 'My Drills')}
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('drills.searchPlaceholder', 'Search drills…')}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="space-y-3 mb-5">
        {/* Sport — only shown for admins or coaches spanning multiple sports; everyone else
            is locked to their own sport (no pills). */}
        {showSportPills && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSportId(null)} className={pill(sportId === null)}>{tr('drills.allSports', 'All Sports')}</button>
            {sports.map(s => (
              <button key={s.id} onClick={() => setSportId(s.id)} className={pill(sportId === s.id)}>{L.sport(SPORT_SHORT[s.id] ?? s.name)}</button>
            ))}
          </div>
        )}
        {/* Category (multi) + difficulty + duration + favorites */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_ORDER.map(c => (
            <button key={c} onClick={() => toggleCategory(c)}
              className={clsx('px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
                categories.has(c) ? CATEGORY_BADGE[c] + ' ring-1 ring-current' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:opacity-80')}>
              {L.category(CATEGORY_LABEL[c])}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {DIFFICULTY_ORDER.map(d => (
            <button key={d} onClick={() => setDifficulty(difficulty === d ? null : d)}
              className={clsx('px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
                difficulty === d ? DIFFICULTY_BADGE[d] + ' ring-1 ring-current' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:opacity-80')}>
              {L.difficulty(d)}
            </button>
          ))}
          <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
          <select value={duration} onChange={(e) => setDuration(e.target.value as DurationFilter)}
            className="rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 cursor-pointer">
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{tr(d.key, d.label)}</option>)}
          </select>
          <button onClick={() => setFavoritesOnly(v => !v)}
            className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
              favoritesOnly ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-current' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>
            <Heart size={11} className={favoritesOnly ? 'fill-red-500 text-red-500' : ''} /> {tr('drills.favorites', 'Favorites')}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={11} /> {tr('common.clear', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <CardListSkeleton count={6} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Library />} title={tr('drills.noDrillsFound', 'No drills found')}
          description={tab === 'mine' ? tr('drills.noneCreated', "You haven't created any drills yet.") : tr('drills.adjustFilters', 'Try adjusting your filters or search.')}
          action={tab === 'mine' && canManage ? { label: tr('drills.createDrill', 'Create Drill'), onClick: () => { setEditing(null); setCreateOpen(true); } } : undefined} />
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length === 1 ? tr('drills.drillCountOne', '{{count}} drill', { count: filtered.length }) : tr('drills.drillCountOther', '{{count}} drills', { count: filtered.length })}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map(d => (
              <DrillCard key={d.id} drill={d} canAssign={canManage} onOpen={setDetail} onAssign={setAssigning} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"><ChevronLeft size={16} /></button>
              <span className="text-sm text-gray-500">{tr('drills.pageOf', 'Page {{page}} of {{total}}', { page, total: totalPages })}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <DrillDetailModal
        isOpen={!!detail} onClose={() => setDetail(null)} drill={detail} canAssign={canManage}
        onAssign={(d) => { setDetail(null); setAssigning(d); }}
        onEdit={(d) => { setDetail(null); setEditing(d); setCreateOpen(true); }}
      />
      <AssignDrillModal
        isOpen={!!assigning} onClose={() => setAssigning(null)} drill={assigning}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        lockedPlayerId={isSolo ? myPlayer?.id : undefined}
      />
      <CreateDrillModal isOpen={createOpen} onClose={() => setCreateOpen(false)} drill={editing} defaultSportId={defaultSportId} />
    </PageWrapper>
  );
}

function pill(active: boolean): string {
  return clsx('px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
    active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700');
}
