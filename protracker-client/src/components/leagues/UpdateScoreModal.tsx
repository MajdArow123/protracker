import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { useUpdateLeagueScore } from '../../hooks/useLeagues';
import type { LeagueMatch } from '../../types';

type Translate = (key: string, fallback: string) => string;

// Score label per format ("Goals" vs "Sets" vs "Points").
function scoreNoun(scoreFormat: string, tr: Translate): string {
  if (scoreFormat === 'Points') return tr('leagues.scoreNounPoints', 'points');
  if (scoreFormat === 'Sets' || scoreFormat === 'GamesAndSets') return tr('leagues.scoreNounSets', 'sets');
  return tr('leagues.scoreNounGoals', 'goals');
}

export function UpdateScoreModal({ leagueId, match, scoreFormat, isOpen, onClose }: {
  leagueId: number; match: LeagueMatch | null; scoreFormat: string; isOpen: boolean; onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const update = useUpdateLeagueScore(leagueId);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [setScores, setSetScores] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !match) return;
    setHome(match.homeScore != null ? String(match.homeScore) : '');
    setAway(match.awayScore != null ? String(match.awayScore) : '');
    setSetScores(match.setScores ?? '');
    setError('');
  }, [isOpen, match]);

  if (!match) return null;
  const showSets = scoreFormat === 'Sets' || scoreFormat === 'GamesAndSets';

  const submit = async () => {
    if (home === '' || away === '') { setError(tr('leagues.errEnterScores', 'Enter both scores.')); return; }
    setError('');
    try {
      await update.mutateAsync({
        matchId: match.id,
        data: { homeScore: Number(home), awayScore: Number(away), setScores: setScores.trim() || null, status: 'Completed' },
      });
      addToast(tr('leagues.scoreSaved', 'Score saved'), 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('leagues.errSaveScore', 'Failed to save score.'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tr('leagues.updateScoreTitle', 'Update score')} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 truncate">{match.homeTeamName}</label>
            <Input type="number" min={0} value={home} onChange={e => setHome(e.target.value)} className="text-center text-lg font-bold" />
          </div>
          <span className="pb-2 text-gray-400 font-bold">–</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 truncate text-right">{match.awayTeamName}</label>
            <Input type="number" min={0} value={away} onChange={e => setAway(e.target.value)} className="text-center text-lg font-bold" />
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center capitalize">{tr('leagues.totalPerTeam', 'Total {{noun}} for each team', { noun: scoreNoun(scoreFormat, tr) })}</p>

        {showSets && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('leagues.setScoresLabel', 'Set scores (optional)')}</label>
            <Input value={setScores} onChange={e => setSetScores(e.target.value)} placeholder={tr('leagues.setScoresPlaceholder', 'e.g. 25-20, 25-18, 23-25, 25-22')} />
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={submit} isLoading={update.isPending}>{tr('leagues.saveScore', 'Save Score')}</Button>
        </div>
      </div>
    </Modal>
  );
}
