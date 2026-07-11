import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, ChevronRight, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAddMatchStats } from '../../hooks/useEvidence';
import { MATCH_STAT_FIELDS } from './matchStatFields';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sportId: number | null | undefined;
  matchResultId: number;
  matchDate: string;
  players: PlayerOption[];
}

// After logging a match: step through the squad one player at a time and record their
// sport-specific stats for that match (each save links to the MatchResult).
export function MatchStatsQuickEntryModal({ isOpen, onClose, sportId, matchResultId, matchDate, players }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const addStats = useAddMatchStats();
  const fields = MATCH_STAT_FIELDS[sportId ?? 0] ?? [];

  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (isOpen) { setIndex(0); setValues({}); setSavedCount(0); }
  }, [isOpen]);

  const player = players[index];
  const isLast = index >= players.length - 1;
  const filled = fields.some(f => values[f.key]?.trim());

  function advance() {
    setValues({});
    if (isLast) {
      if (savedCount > 0)
        addToast(t('evidence.quickStatsDone', 'Stats saved for {{count}} players', { count: savedCount }), 'success');
      onClose();
    } else {
      setIndex(i => i + 1);
    }
  }

  async function saveAndNext() {
    if (!player) return;
    const stats: Record<string, number> = {};
    for (const f of fields) {
      const raw = values[f.key]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || (f.kind === '%' && n > 100)) {
        addToast(t('evidence.invalidStat', 'Invalid value for {{field}}', { field: f.label(t) }), 'error');
        return;
      }
      stats[f.key] = n;
    }
    if (Object.keys(stats).length === 0) { advance(); return; }
    try {
      await addStats.mutateAsync({
        playerId: player.id,
        statDate: matchDate.split('T')[0],
        stats,
        matchResultId,
      });
      setSavedCount(c => c + 1);
      advance();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  if (!player || fields.length === 0) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={t('evidence.quickStatsTitle', 'Player Stats ({{current}}/{{total}})', { current: index + 1, total: players.length })}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} className="text-sky-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">{player.name}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 truncate">
                {f.label(t)}{f.kind === '%' ? ' (%)' : ''}
              </label>
              <input
                type="number"
                step={f.kind === 'int' ? 1 : 'any'}
                min={0}
                max={f.kind === '%' ? 100 : undefined}
                value={values[f.key] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={advance}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
            {isLast ? t('evidence.quickStatsFinish', 'Finish') : t('common.skip', 'Skip')}
          </button>
          <Button type="button" size="sm" onClick={saveAndNext} isLoading={addStats.isPending} disabled={!filled}>
            {isLast
              ? <><Check size={13} /> {t('evidence.saveAndFinish', 'Save & Finish')}</>
              : <>{t('evidence.saveAndNext', 'Save & Next')} <ChevronRight size={13} /></>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
