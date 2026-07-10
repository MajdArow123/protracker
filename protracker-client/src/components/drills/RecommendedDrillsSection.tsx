import { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { DrillCard } from './DrillCard';
import { DrillDetailModal } from './DrillDetailModal';
import { AssignDrillModal } from './AssignDrillModal';
import { AIDrillRecommendationsModal } from './AIDrillRecommendationsModal';
import { useRecommendedDrills } from '../../hooks/useDrills';
import type { Drill } from '../../types';
import { useTranslation } from 'react-i18next';

interface PlayerOption { id: number; name: string; }

interface Props {
  isCoach: boolean;
  canAssign: boolean;
  // Coach: choose which player to recommend for. Athlete/solo: locked to themselves.
  players: PlayerOption[];
  lockedPlayerId?: number;
}

// "Recommended for You" — drills matching the player's weakest assessment areas, with an AI
// button for ranked + explained picks. Shows for a solo/team athlete (self) or a coach who
// has picked a player.
export function RecommendedDrillsSection({ isCoach, canAssign, players, lockedPlayerId }: Props) {
  const { t } = useTranslation();
  const [selectedPlayer, setSelectedPlayer] = useState<number | ''>('');
  const contextId = lockedPlayerId ?? (selectedPlayer || undefined);

  const { data, isLoading } = useRecommendedDrills(contextId);
  const drills = data?.items ?? [];

  const [detail, setDetail] = useState<Drill | null>(null);
  const [assigning, setAssigning] = useState<Drill | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  // Coach with no player picked yet → compact picker prompt.
  if (isCoach && !contextId) {
    return (
      <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-900/15 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Sparkles size={17} className="text-indigo-500 flex-shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('drills.recommendPrompt', "See drills recommended for a player's weak areas:")}</p>
          </div>
          <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white">
            <option value="">{t('drills.selectPlayerOption', 'Select a player…')}</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  if (!contextId) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-gray-900 dark:text-white">
            <Sparkles size={17} className="text-indigo-500" /> {isCoach ? t('drills.recommendedDrills', 'Recommended drills') : t('drills.recommendedForYou', 'Recommended for you')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('drills.basedOnAssessment', 'Based on the latest assessment')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isCoach && (
            <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300">
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {canAssign && (
            <button onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white cursor-pointer shadow-sm">
              <Wand2 size={15} /> {t('drills.aiRecommendations', 'AI Recommendations')}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="h-40 skeleton rounded-2xl" />)}</div>
      ) : drills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('drills.noRecommendations', 'No recommendations yet — log an assessment to get drill suggestions for weak areas.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drills.slice(0, 3).map(d => (
            <DrillCard key={d.id} drill={d} canAssign={canAssign} recommended onOpen={setDetail} onAssign={setAssigning} />
          ))}
        </div>
      )}

      <DrillDetailModal isOpen={!!detail} onClose={() => setDetail(null)} drill={detail} canAssign={canAssign}
        onAssign={(d) => { setDetail(null); setAssigning(d); }} />
      <AssignDrillModal isOpen={!!assigning} onClose={() => setAssigning(null)} drill={assigning}
        players={players} lockedPlayerId={lockedPlayerId ?? (typeof contextId === 'number' ? contextId : undefined)} />
      <AIDrillRecommendationsModal isOpen={aiOpen} onClose={() => setAiOpen(false)} players={players}
        lockedPlayerId={lockedPlayerId ?? (typeof contextId === 'number' ? contextId : undefined)} canAssign={canAssign} />
    </div>
  );
}
