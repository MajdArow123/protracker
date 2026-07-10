import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { useAddMatchStats } from '../../hooks/useEvidence';
import { useTeamMatches } from '../../hooks/useMatches';
import { MATCH_STAT_FIELDS } from './matchStatFields';
import type { EvidenceBasedScore } from '../../types';

interface Props {
  playerId: number;
  sportId: number;
  teamId?: number | null;
  onSaved?: (scores: EvidenceBasedScore[]) => void;
}

// One form per match: sport-specific numeric stats. A single entry feeds every metric
// with a match-stat mapping, so saving here recalculates all of the player's scores.
export function MatchStatsForm({ playerId, sportId, teamId, onSaved }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const addStats = useAddMatchStats();
  const { data: teamMatches = [] } = useTeamMatches(teamId ?? null);

  const [statDate, setStatDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchResultId, setMatchResultId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const fields = MATCH_STAT_FIELDS[sportId] ?? [];
  const filledCount = fields.filter(f => values[f.key]?.trim()).length;

  function selectMatch(id: string) {
    setMatchResultId(id);
    const match = teamMatches.find(m => String(m.id) === id);
    if (match) setStatDate(match.matchDate.split('T')[0]);
  }

  async function save() {
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
    if (Object.keys(stats).length === 0) {
      addToast(t('evidence.enterAtLeastOneStat', 'Enter at least one stat'), 'error');
      return;
    }
    try {
      const { scores } = await addStats.mutateAsync({
        playerId,
        statDate,
        stats,
        matchResultId: matchResultId ? Number(matchResultId) : null,
      });
      addToast(t('evidence.matchStatsSaved', 'Match stats saved'), 'success');
      setValues({});
      setMatchResultId('');
      onSaved?.(scores);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('evidence.matchDate', 'Match date')}
          type="date"
          value={statDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={e => setStatDate(e.target.value)}
        />
        {teamMatches.length > 0 && (
          <Select
            label={t('evidence.importFromMatch', 'Link to match (optional)')}
            value={matchResultId}
            onChange={e => selectMatch(e.target.value)}
            options={[
              { value: '', label: t('evidence.noLinkedMatch', 'Not linked') },
              ...teamMatches.slice(0, 12).map(m => ({
                value: String(m.id),
                label: `${m.opponentName} — ${m.matchDate.split('T')[0]}`,
              })),
            ]}
          />
        )}
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

      {/* type="button": these forms render inside the assessment <form> — never submit it. */}
      <Button type="button" size="sm" onClick={save} isLoading={addStats.isPending} disabled={filledCount === 0}>
        {t('evidence.saveMatchStats', 'Save Match Stats')}
      </Button>
    </div>
  );
}
