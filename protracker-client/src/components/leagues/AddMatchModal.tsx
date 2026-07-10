import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useCreateLeagueMatch } from '../../hooks/useLeagues';
import type { LeagueTeamEntry } from '../../types';

export function AddMatchModal({ leagueId, teams, isOpen, onClose }: {
  leagueId: number; teams: LeagueTeamEntry[]; isOpen: boolean; onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const create = useCreateLeagueMatch(leagueId);
  const approved = teams.filter(t => t.status === 'Approved');

  const [homeTeamId, setHomeTeamId] = useState<number | ''>('');
  const [awayTeamId, setAwayTeamId] = useState<number | ''>('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [round, setRound] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setHomeTeamId(''); setAwayTeamId(''); setScheduledAt(''); setRound(''); setVenue(''); setError('');
  }, [isOpen]);

  const submit = async () => {
    if (!homeTeamId || !awayTeamId) { setError(tr('leagues.errPickBothTeams', 'Pick both teams.')); return; }
    if (homeTeamId === awayTeamId) { setError(tr('leagues.errSameTeam', "A team can't play itself.")); return; }
    setError('');
    try {
      await create.mutateAsync({
        homeTeamId: Number(homeTeamId),
        awayTeamId: Number(awayTeamId),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        round: round ? Number(round) : null,
        venue: venue.trim() || null,
      });
      addToast(tr('leagues.matchAdded', 'Match added'), 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('leagues.errAddMatchFailed', 'Failed to add match.'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tr('leagues.addMatchTitle', 'Add a match')} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.homeTeam', 'Home team')}</label>
            <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">{tr('leagues.selectPlaceholder', 'Select…')}</option>
              {approved.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.awayTeam', 'Away team')}</label>
            <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">{tr('leagues.selectPlaceholder', 'Select…')}</option>
              {approved.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.dateTime', 'Date & time')}</label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.round', 'Round (optional)')}</label>
            <Input type="number" min={1} value={round} onChange={e => setRound(e.target.value)} placeholder={tr('leagues.roundPlaceholder', 'e.g. 1')} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.venue', 'Venue (optional)')}</label>
          <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder={tr('common.optional', 'Optional')} />
        </div>

        {approved.length < 2 && <p className="text-sm text-amber-600 dark:text-amber-400">{tr('leagues.needTwoTeams', 'Approve at least 2 teams before adding matches.')}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={submit} isLoading={create.isPending} disabled={approved.length < 2}>{tr('leagues.addMatch', 'Add Match')}</Button>
        </div>
      </div>
    </Modal>
  );
}
