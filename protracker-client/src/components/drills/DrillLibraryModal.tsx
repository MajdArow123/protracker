import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { DrillCard } from './DrillCard';
import { AssignDrillModal } from './AssignDrillModal';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { SPORT_SHORT } from './drillUtils';
import { useDrills } from '../../hooks/useDrills';
import { useSports } from '../../hooks/useSports';
import { useTeams } from '../../hooks/useTeams';
import { useMyPlayer } from '../../hooks/usePlayers';
import { useAuth } from '../../context/AuthContext';
import type { Drill } from '../../types';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerOption[];
  lockedPlayerId?: number;
  defaultSportId?: number;
}

// Compact drill browser shown from the Tasks page — pick a drill, then assign it as a task.
export function DrillLibraryModal({ isOpen, onClose, players, lockedPlayerId, defaultSportId }: Props) {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const isAdmin = user?.role === 'Admin';
  const { data: sports = [] } = useSports();
  const { data: coachTeams = [] } = useTeams(isCoach && isOpen);
  const { data: myPlayer } = useMyPlayer(!isCoach && isOpen);

  // Same sport-scoping as the library page: locked to the user's sport unless admin / multi-sport coach.
  const coachSports = useMemo(() => [...new Set(coachTeams.map(t => t.sportId))], [coachTeams]);
  const showSportPills = isAdmin || (isCoach && coachSports.length !== 1);
  const lockedSportId = showSportPills ? undefined : (isCoach ? coachSports[0] : myPlayer?.sportId) ?? defaultSportId;

  const [search, setSearch] = useState('');
  const [sportId, setSportId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState<Drill | null>(null);

  const effectiveSportId = showSportPills ? sportId : (lockedSportId ?? null);
  const sportReady = showSportPills || lockedSportId != null;

  const { data, isLoading } = useDrills(
    { sport: effectiveSportId, search: search.trim() || undefined, pageSize: 60 },
    isOpen && sportReady,
  );
  const drills = data?.items ?? [];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Browse Drill Library" size="xl">
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drills…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white" />
          </div>
          {showSportPills && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setSportId(null)} className={pill(sportId === null)}>All</button>
              {sports.map(s => (
                <button key={s.id} onClick={() => setSportId(s.id)} className={pill(sportId === s.id)}>{SPORT_SHORT[s.id] ?? s.name}</button>
              ))}
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {isLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : drills.length === 0 ? (
              <EmptyState icon={<Search />} title="No drills found" description="Try a different search or sport." size="sm" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {drills.map(d => (
                  <DrillCard key={d.id} drill={d} canAssign onOpen={setAssigning} onAssign={setAssigning} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <AssignDrillModal
        isOpen={!!assigning}
        onClose={() => setAssigning(null)}
        drill={assigning}
        players={players}
        lockedPlayerId={lockedPlayerId}
      />
    </>
  );
}

function pill(active: boolean): string {
  return clsx('px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer',
    active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300');
}
