import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Shield } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useTeams } from '../../hooks/useTeams';
import { useRegisterLeagueTeam } from '../../hooks/useLeagues';
import type { LeagueDetail } from '../../types';

export function RegisterTeamModal({ league, isOpen, onClose }: {
  league: LeagueDetail; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const { data: teams = [] } = useTeams(isOpen);
  const register = useRegisterLeagueTeam(league.id);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Only teams matching the league's sport, not already registered.
  const registeredTeamIds = new Set(league.teams.filter(t => t.status !== 'Rejected').map(t => t.teamId));
  const eligible = teams.filter(t => t.sportId === league.sportId && !registeredTeamIds.has(t.id));

  useEffect(() => {
    if (isOpen) { setTeamId(null); setError(''); }
  }, [isOpen]);

  const submit = async () => {
    if (!teamId) { setError('Select a team.'); return; }
    setError('');
    try {
      const res = await register.mutateAsync(teamId);
      addToast(res.status === 'Approved' ? 'Team registered' : 'Registration submitted — awaiting approval', 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register a team" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Register one of your {league.sportName} teams for <span className="font-semibold text-gray-900 dark:text-white">{league.name}</span>.
          {!league.isOrganizer && ' The organizer will need to approve it.'}
        </p>

        {eligible.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            You have no eligible {league.sportName} teams to register.
          </div>
        ) : (
          <div className="space-y-2">
            {eligible.map(t => (
              <button key={t.id} onClick={() => setTeamId(t.id)}
                className={clsx('w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer',
                  teamId === t.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300')}>
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <Shield size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.playerCount} players</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={register.isPending} disabled={eligible.length === 0}>Register</Button>
        </div>
      </div>
    </Modal>
  );
}
