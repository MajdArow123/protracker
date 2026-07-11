import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Star, Trophy, BarChart2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { ConfirmModal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useTeamMatches, useCreateMatch, useUpdateMatch, useDeleteMatch, useSaveMatchRatings } from '../../hooks/useMatches';
import type { MatchResult, MatchOutcome, PlayerMatchRating } from '../../types';
import type { RatingInput } from '../../api/matchesApi';
import { statFieldsForSport, scoreLabelsForSport, setDetailConfig, scoreUnit, parseStatJson } from '../../utils/matchSport';
import { MatchStatsQuickEntryModal } from '../evidence/MatchStatsQuickEntryModal';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface PlayerOption { id: number; name: string; }

const RESULT_STYLES: Record<MatchOutcome, { text: string; badge: string; score: string }> = {
  Win: { text: 'text-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', score: 'text-green-500' },
  Draw: { text: 'text-gray-500', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', score: 'text-gray-400' },
  Loss: { text: 'text-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', score: 'text-red-500' },
};

// Read a stat value: prefer statJson, fall back to legacy soccer columns for old rows.
function statValue(r: PlayerMatchRating, key: string): number {
  const parsed = parseStatJson(r.statJson);
  if (key in parsed) return parsed[key];
  const legacy = r as unknown as Record<string, number>;
  return typeof legacy[key] === 'number' ? legacy[key] : 0;
}

// ── Log / edit match modal ───────────────────────────────────────────────────
function LogMatchModal({ teamId, sportName, match, isOpen, onClose, onCreated }: {
  teamId: number; sportName?: string; match: MatchResult | null; isOpen: boolean; onClose: () => void; onCreated: (m: MatchResult) => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const isEdit = !!match;
  const labels = scoreLabelsForSport(sportName);
  const setCfg = setDetailConfig(sportName);

  const [opponentName, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [ourScore, setOurScore] = useState('0');
  const [oppScore, setOppScore] = useState('0');
  const [setScores, setSetScores] = useState('');
  const [competition, setCompetition] = useState('League');
  const [venue, setVenue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (match) {
      setOpponent(match.opponentName);
      setMatchDate(match.matchDate.split('T')[0]);
      setIsHome(match.isHome);
      setOurScore(String(match.ourScore));
      setOppScore(String(match.opponentScore));
      setSetScores(match.setScores ?? '');
      setCompetition(match.competition ?? 'League');
      setVenue(match.venue ?? '');
      setNotes(match.notes ?? '');
    } else {
      setOpponent(''); setMatchDate(new Date().toISOString().split('T')[0]); setIsHome(true);
      setOurScore('0'); setOppScore('0'); setSetScores(''); setCompetition('League'); setVenue(''); setNotes('');
    }
  }, [isOpen, match]);

  async function handleSubmit() {
    if (!opponentName.trim()) { setError(tr('matches.errOpponentRequired', 'Opponent is required')); return; }
    if (!matchDate) { setError(tr('matches.errDateRequired', 'Match date is required')); return; }
    const our = Number(ourScore) || 0;
    const opp = Number(oppScore) || 0;
    const payload = {
      opponentName: opponentName.trim(),
      matchDate,
      isHome,
      homeScore: isHome ? our : opp,
      awayScore: isHome ? opp : our,
      setScores: setCfg.enabled && setScores.trim() ? setScores.trim() : undefined,
      competition: competition.trim() || undefined,
      venue: venue.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (isEdit && match) {
        await updateMatch.mutateAsync({ id: match.id, data: payload });
        addToast(tr('matches.matchUpdated', 'Match updated'), 'success');
        onClose();
      } else {
        const created = await createMatch.mutateAsync({ teamId, data: payload });
        addToast(tr('matches.matchLogged', 'Match logged'), 'success');
        onCreated(created);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('matches.saveFailed', 'Save failed'), 'error');
    }
  }

  const saving = createMatch.isPending || updateMatch.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? tr('matches.editMatch', 'Edit Match') : tr('matches.logMatch', 'Log Match')}>
      <div className="space-y-4">
        <Input label={tr('matches.opponent', 'Opponent')} value={opponentName} onChange={e => setOpponent(e.target.value)} placeholder={tr('matches.opponentPlaceholder', 'e.g. Rovers FC')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={tr('common.date', 'Date')} type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{tr('matches.homeAway', 'Home / Away')}</label>
            <div className="flex gap-2">
              {([['Home', true], ['Away', false]] as [string, boolean][]).map(([label, val]) => (
                <button key={label} type="button" onClick={() => setIsHome(val)}
                  className={clsx('flex-1 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer',
                    isHome === val ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                  {label === 'Home' ? tr('matches.home', 'Home') : tr('matches.away', 'Away')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={labels.for} type="number" min={0} value={ourScore} onChange={e => setOurScore(e.target.value)} />
          <Input label={labels.against} type="number" min={0} value={oppScore} onChange={e => setOppScore(e.target.value)} />
        </div>
        {setCfg.enabled && (
          <Input label={setCfg.label} value={setScores} onChange={e => setSetScores(e.target.value)} placeholder={setCfg.placeholder} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label={tr('matches.competition', 'Competition')} value={competition} onChange={e => setCompetition(e.target.value)} placeholder={tr('matches.competitionPlaceholder', 'League / Cup')} />
          <Input label={tr('matches.venue', 'Venue (optional)')} value={venue} onChange={e => setVenue(e.target.value)} placeholder={tr('matches.venuePlaceholder', 'Stadium')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('common.notes', 'Notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={tr('matches.notesPlaceholder', 'Match summary…')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={saving}>{isEdit ? tr('matches.saveChanges', 'Save Changes') : tr('matches.logMatchAndRate', 'Log Match & Add Ratings')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Player ratings entry modal ───────────────────────────────────────────────
interface RatingRow { playerId: number; name: string; rating: number; stats: Record<string, string>; }

function RateMatchModal({ match, sportName, players, isOpen, onClose }: {
  match: MatchResult | null; sportName?: string; players: PlayerOption[]; isOpen: boolean; onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const saveRatings = useSaveMatchRatings();
  const fields = statFieldsForSport(sportName);
  const [rows, setRows] = useState<RatingRow[]>([]);

  useEffect(() => {
    if (!isOpen || !match) return;
    setRows(players.map(p => {
      const existing = match.ratings.find(r => r.playerId === p.id);
      const stats: Record<string, string> = {};
      for (const f of fields) {
        const v = existing ? statValue(existing, f.key) : (f.key === 'minutesPlayed' ? 90 : 0);
        stats[f.key] = String(v);
      }
      return { playerId: p.id, name: p.name, rating: existing?.rating ?? 6, stats };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, match, players, sportName]);

  function update(playerId: number, patch: Partial<RatingRow>) {
    setRows(rs => rs.map(r => r.playerId === playerId ? { ...r, ...patch } : r));
  }
  function updateStat(playerId: number, key: string, value: string) {
    setRows(rs => rs.map(r => r.playerId === playerId ? { ...r, stats: { ...r.stats, [key]: value } } : r));
  }

  async function handleSave() {
    if (!match) return;
    const ratings: RatingInput[] = rows.map(r => {
      const stats: Record<string, number> = {};
      for (const f of fields) stats[f.key] = Number(r.stats[f.key]) || 0;
      return { playerId: r.playerId, rating: r.rating, statJson: JSON.stringify(stats) };
    });
    try {
      await saveRatings.mutateAsync({ id: match.id, ratings });
      addToast(tr('matches.ratingsSaved', 'Ratings saved'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('matches.saveFailed', 'Save failed'), 'error');
    }
  }

  const cols = Math.min(fields.length, 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={match ? tr('matches.ratePlayersVs', 'Rate Players — vs {{opponent}}', { opponent: match.opponentName }) : tr('matches.ratePlayers', 'Rate Players')} size="lg">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {rows.map(row => (
          <div key={row.playerId} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{row.name}</span>
              <span className="text-sm font-black text-indigo-500">{row.rating.toFixed(1)}</span>
            </div>
            <input type="range" min={1} max={10} step={0.5} value={row.rating}
              onChange={e => update(row.playerId, { rating: Number(e.target.value) })}
              className="w-full accent-indigo-600 mb-2" />
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">{f.full}</label>
                  <input type="number" min={0} value={row.stats[f.key] ?? '0'}
                    onChange={e => updateStat(row.playerId, f.key, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
        <Button onClick={handleSave} isLoading={saveRatings.isPending}>{tr('matches.saveRatings', 'Save Ratings')}</Button>
      </div>
    </Modal>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────
export function TeamMatchesSection({ teamId, sportName, sportId, players, isCoach }: { teamId: number; sportName?: string; sportId?: number; players: PlayerOption[]; isCoach: boolean; }) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (s: string) => formatDate(s, { month: 'short', day: 'numeric', year: 'numeric' });
  const { data: matches = [], isLoading } = useTeamMatches(teamId);
  const deleteMatch = useDeleteMatch();
  const { addToast } = useToast();
  const fields = statFieldsForSport(sportName);

  const [logOpen, setLogOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<MatchResult | null>(null);
  const [rateMatch, setRateMatch] = useState<MatchResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MatchResult | null>(null);
  // Evidence quick entry: per-player stats for a match. justRated remembers a freshly
  // created match so closing the ratings modal can offer the stats step next.
  const [statsMatch, setStatsMatch] = useState<MatchResult | null>(null);
  const [statsPrompt, setStatsPrompt] = useState<MatchResult | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);

  const rateMatchLive = rateMatch ? matches.find(m => m.id === rateMatch.id) ?? rateMatch : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Star size={16} className="text-indigo-400" /> {tr('matches.matchResults', 'Match Results')}</h3>
        {isCoach && (
          <button onClick={() => { setEditMatch(null); setLogOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer">
            <Plus size={13} /> {tr('matches.logMatch', 'Log Match')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : matches.length === 0 ? (
        <EmptyState icon={<Trophy size={40} />} title={tr('matches.noMatches', 'No matches recorded yet')}
          description={isCoach ? tr('matches.noMatchesCoach', 'Log your first match result to start tracking performances.') : tr('matches.noMatchesAthlete', "Your coach hasn't logged any matches yet.")}
          size="sm"
          action={isCoach ? { label: tr('matches.logFirstMatch', 'Log First Match'), onClick: () => { setEditMatch(null); setLogOpen(true); } } : undefined} />
      ) : (
        <div className="space-y-3">
          {matches.map(m => {
            const rs = RESULT_STYLES[m.result];
            const isOpen = expanded === m.id;
            const unit = scoreUnit(m.scoreFormat);
            const canExpand = m.ratings.length > 0 || !!m.setScores;
            return (
              <div key={m.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="text-center flex-shrink-0 w-20">
                    <p className={clsx('text-2xl font-black tabular-nums', rs.score)}>{m.ourScore} - {m.opponentScore}</p>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', rs.badge)}>{L.status(m.result)}{unit ? ` · ${unit}` : ''}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {m.isHome ? tr('matches.vs', 'vs') : tr('matches.at', '@')} {m.opponentName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{fmtDate(m.matchDate)}</span>
                      {m.competition && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{m.competition}</span>}
                      {m.setScores && <span className="text-[10px] text-gray-400">{m.setScores}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isCoach && (
                      <>
                        <button onClick={() => setRateMatch(m)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap">{tr('matches.ratePlayers', 'Rate Players')}</button>
                        {sportId != null && (
                          <button onClick={() => setStatsMatch(m)} title={tr('evidence.addPlayerStats', 'Add player stats')} aria-label={tr('evidence.addPlayerStats', 'Add player stats')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all cursor-pointer">
                            <BarChart2 size={14} />
                          </button>
                        )}
                        <button onClick={() => { setEditMatch(m); setLogOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                      </>
                    )}
                    {canExpand && (
                      <button onClick={() => setExpanded(isOpen ? null : m.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all cursor-pointer">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 overflow-x-auto">
                    {m.setScores && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span className="font-semibold">{tr('matches.setScoresLabel', 'Set scores:')}</span> {m.setScores}
                      </p>
                    )}
                    {m.ratings.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                            <th className="font-semibold pb-2 pr-3">{tr('matches.colPlayer', 'Player')}</th>
                            <th className="font-semibold pb-2 px-2">{tr('matches.colRating', 'Rating')}</th>
                            {fields.map(f => <th key={f.key} className="font-semibold pb-2 px-2">{f.label}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {m.ratings.map(r => (
                            <tr key={r.id} className="text-gray-700 dark:text-gray-300">
                              <td className="py-1.5 pr-3 font-medium text-gray-900 dark:text-white flex items-center gap-1">
                                {r.rating >= 8 && <Trophy size={12} className="text-amber-400" />}{r.playerName}
                              </td>
                              <td className="px-2 font-bold text-indigo-500">{r.rating.toFixed(1)}</td>
                              {fields.map(f => <td key={f.key} className="px-2">{statValue(r, f.key)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isCoach && (
        <>
          <LogMatchModal teamId={teamId} sportName={sportName} match={editMatch} isOpen={logOpen}
            onClose={() => { setLogOpen(false); setEditMatch(null); }}
            onCreated={(m) => { setLogOpen(false); setJustCreatedId(m.id); setRateMatch(m); }} />
          <RateMatchModal match={rateMatchLive} sportName={sportName} players={players} isOpen={!!rateMatch}
            onClose={() => {
              // For a freshly logged match, offer the evidence stats step next.
              if (sportId != null && rateMatch && rateMatch.id === justCreatedId) setStatsPrompt(rateMatch);
              setJustCreatedId(null);
              setRateMatch(null);
            }} />

          {/* Evidence: per-player match stats quick entry */}
          <ConfirmModal
            isOpen={!!statsPrompt}
            onClose={() => setStatsPrompt(null)}
            onConfirm={() => { setStatsMatch(statsPrompt); setStatsPrompt(null); }}
            title={tr('evidence.addStatsPromptTitle', 'Add Player Stats?')}
            message={tr('evidence.addStatsPromptMsg', 'Would you like to record player statistics for this match? They feed evidence-based scores.')}
            confirmLabel={tr('evidence.addStats', 'Add Stats')}
          />
          {statsMatch && sportId != null && (
            <MatchStatsQuickEntryModal
              isOpen={!!statsMatch}
              onClose={() => setStatsMatch(null)}
              sportId={sportId}
              matchResultId={statsMatch.id}
              matchDate={statsMatch.matchDate}
              players={players}
            />
          )}
          <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
            onConfirm={async () => { if (!deleteTarget) return; try { await deleteMatch.mutateAsync(deleteTarget.id); addToast(tr('matches.matchDeleted', 'Match deleted'), 'success'); } catch (err) { addToast(err instanceof Error ? err.message : tr('matches.deleteFailed', 'Delete failed'), 'error'); } finally { setDeleteTarget(null); } }}
            title={tr('matches.deleteMatchTitle', 'Delete Match')} message={tr('matches.deleteMatchMsg', 'Delete the match vs {{opponent}}?', { opponent: deleteTarget?.opponentName })} confirmLabel={tr('common.delete', 'Delete')} isLoading={deleteMatch.isPending} />
        </>
      )}
    </div>
  );
}
