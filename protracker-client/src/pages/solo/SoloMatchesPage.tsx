import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Trophy, ChevronDown, ChevronUp, Star, CalendarPlus } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useToast } from '../../context/useToast';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { useSoloProfile, useSoloMatches, useCreateSoloMatch } from '../../hooks/useSolo';
import { useUpdateMatch, useDeleteMatch, useSaveMatchRatings } from '../../hooks/useMatches';
import { scoreLabelsForSport, setDetailConfig, scoreUnit } from '../../utils/matchSport';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { MatchResult, MatchOutcome, MatchStatus } from '../../types';

const RESULT_STYLES: Record<MatchOutcome, { badge: string; score: string }> = {
  Win: { badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', score: 'text-green-500' },
  Draw: { badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', score: 'text-gray-400' },
  Loss: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', score: 'text-red-500' },
};

function myRating(m: MatchResult): number | null {
  return m.ratings.length > 0 ? m.ratings[0].rating : null;
}

function ratingColor(r: number) {
  return r < 5 ? 'text-red-500 bg-red-500/10' : r < 7 ? 'text-amber-500 bg-amber-500/10' : 'text-green-500 bg-green-500/10';
}

// ── Log / edit modal ─────────────────────────────────────────────────────────
function LogSoloMatchModal({ sportName, playerId, match, isOpen, onClose }: {
  sportName?: string; playerId: number; match: MatchResult | null; isOpen: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const createMatch = useCreateSoloMatch();
  const updateMatch = useUpdateMatch();
  const saveRatings = useSaveMatchRatings();
  const isEdit = !!match;
  const labels = scoreLabelsForSport(sportName);
  const setCfg = setDetailConfig(sportName);

  const [opponentName, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [status, setStatus] = useState<MatchStatus>('Played');
  const [isHome, setIsHome] = useState(true);
  const [ourScore, setOurScore] = useState('0');
  const [oppScore, setOppScore] = useState('0');
  const [setScores, setSetScores] = useState('');
  const [competition, setCompetition] = useState('');
  const [rating, setRating] = useState(7);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const scheduled = status === 'Scheduled';

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (match) {
      setOpponent(match.opponentName);
      setMatchDate(match.matchDate.split('T')[0]);
      setStatus(match.status);
      setIsHome(match.isHome);
      setOurScore(String(match.ourScore ?? 0));
      setOppScore(String(match.opponentScore ?? 0));
      setSetScores(match.setScores ?? '');
      setCompetition(match.competition ?? '');
      setRating(myRating(match) ?? 7);
      setNotes(match.notes ?? '');
    } else {
      setOpponent(''); setMatchDate(new Date().toISOString().split('T')[0]); setStatus('Played'); setIsHome(true);
      setOurScore('0'); setOppScore('0'); setSetScores(''); setCompetition(''); setRating(7); setNotes('');
    }
  }, [isOpen, match]);

  async function handleSubmit() {
    if (!opponentName.trim()) { setError(t('matches.errOpponentRequired', 'Opponent is required')); return; }
    if (!matchDate) { setError(t('matches.errDateRequired', 'Match date is required')); return; }
    const our = Number(ourScore) || 0;
    const opp = Number(oppScore) || 0;
    const payload = {
      opponentName: opponentName.trim(),
      matchDate,
      status,
      isHome,
      // A fixture has no score — the backend ignores these, send honest zeros.
      homeScore: scheduled ? 0 : (isHome ? our : opp),
      awayScore: scheduled ? 0 : (isHome ? opp : our),
      setScores: !scheduled && setCfg.enabled && setScores.trim() ? setScores.trim() : undefined,
      competition: competition.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (isEdit && match) {
        await updateMatch.mutateAsync({ id: match.id, data: payload });
        // The "how did I play?" rating rides on the athlete's own PlayerMatchRating.
        // An unplayed fixture has no performance to rate (server 400s it).
        if (!scheduled) await saveRatings.mutateAsync({ id: match.id, ratings: [{ playerId, rating }] });
        addToast(t('matches.matchUpdated', 'Match updated'), 'success');
      } else {
        await createMatch.mutateAsync({ ...payload, personalRating: scheduled ? undefined : rating });
        addToast(scheduled ? t('matches.fixtureScheduled', 'Fixture scheduled') : t('matches.matchLoggedSolo', 'Match logged — nice one!'), 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('matches.saveFailed', 'Save failed'), 'error');
    }
  }

  const saving = createMatch.isPending || updateMatch.isPending || saveRatings.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('matches.editMatch', 'Edit Match') : t('matches.logMatch', 'Log Match')}>
      <div className="space-y-4">
        {/* Record a played result vs schedule an upcoming fixture (Phase 7a). */}
        <div className="flex gap-2" role="radiogroup" aria-label={t('matches.matchMode', 'Match type')}>
          {([['Played', t('matches.modeRecord', 'Record result'), Trophy], ['Scheduled', t('matches.modeSchedule', 'Schedule fixture'), CalendarPlus]] as const).map(([val, label, Icon]) => (
            <button key={val} type="button" role="radio" aria-checked={status === val} onClick={() => setStatus(val)}
              className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer',
                status === val ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <Input label={t('matches.whoPlayed', 'Who did you play against?')} value={opponentName} onChange={e => setOpponent(e.target.value)} placeholder={t('matches.opponentSoloPlaceholder', 'e.g. Riverside pickup squad')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('common.date', 'Date')} type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('matches.homeAway', 'Home / Away')}</label>
            <div className="flex gap-2">
              {([['Home', true], ['Away', false]] as [string, boolean][]).map(([label, val]) => (
                <button key={label} type="button" onClick={() => setIsHome(val)}
                  className={clsx('flex-1 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer',
                    isHome === val ? 'bg-indigo-600 text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                  {label === 'Home' ? t('matches.home', 'Home') : t('matches.away', 'Away')}
                </button>
              ))}
            </div>
          </div>
        </div>
        {scheduled ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
            {t('matches.scheduleHintSolo', 'No score yet — this saves an upcoming fixture. Record the result and rate your game after you play.')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label={labels.for.replace('Our', 'My')} type="number" min={0} value={ourScore} onChange={e => setOurScore(e.target.value)} />
              <Input label={labels.against} type="number" min={0} value={oppScore} onChange={e => setOppScore(e.target.value)} />
            </div>
            {setCfg.enabled && (
              <Input label={setCfg.label} value={setScores} onChange={e => setSetScores(e.target.value)} placeholder={setCfg.placeholder} />
            )}
          </>
        )}
        <Input label={t('matches.competitionOptional', 'Competition (optional)')} value={competition} onChange={e => setCompetition(e.target.value)} placeholder={t('matches.competitionSoloPlaceholder', 'League / Pickup / Tournament')} />

        {!scheduled && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('matches.howPlayed', 'How did you play?')}</label>
              <span className={clsx('text-sm font-black px-2 py-0.5 rounded-lg', ratingColor(rating))}>{rating.toFixed(1)}</span>
            </div>
            <input type="range" min={1} max={10} step={0.5} value={rating}
              onChange={e => setRating(Number(e.target.value))} className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{t('matches.ratingLow', '1 — Rough day')}</span>
              <span>{t('matches.ratingHigh', '10 — Best game ever')}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.notes', 'Notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('matches.notesSoloPlaceholder', 'What went well, what to work on…')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            {isEdit
              ? t('matches.saveChanges', 'Save Changes')
              : scheduled ? t('matches.scheduleFixture', 'Schedule Fixture') : t('matches.logMatch', 'Log Match')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function SoloMatchesPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (s: string) => formatDate(s, { month: 'short', day: 'numeric', year: 'numeric' });
  const { data: playerId } = useMyPlayerId();
  const { data: soloProfile } = useSoloProfile();
  const { data: matches = [], isLoading } = useSoloMatches();
  const deleteMatch = useDeleteMatch();
  const { addToast } = useToast();

  const [logOpen, setLogOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<MatchResult | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MatchResult | null>(null);

  const stats = useMemo(() => {
    const wins = matches.filter(m => m.result === 'Win').length;
    const draws = matches.filter(m => m.result === 'Draw').length;
    const losses = matches.filter(m => m.result === 'Loss').length;
    // Fixtures aren't matches played — count only real results.
    const played = matches.filter(m => m.status === 'Played').length;
    const rated = matches.map(myRating).filter((r): r is number => r != null);
    const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
    return { wins, draws, losses, played, avgRating };
  }, [matches]);

  return (
    <PageWrapper
      title={t('matches.myMatches', 'My Matches')}
      actions={
        <button onClick={() => { setEditMatch(null); setLogOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
          <Plus size={15} /> {t('matches.logMatch', 'Log Match')}
        </button>
      }
    >
      {matches.length > 0 && (
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('matches.record', 'Record')}</p>
            <p className="text-xl font-black">
              <span className="text-green-500">{stats.wins}W</span>
              <span className="text-gray-400"> – {stats.draws}D – </span>
              <span className="text-red-500">{stats.losses}L</span>
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('matches.matchesLabel', 'Matches')}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{stats.played}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Star size={12} className="text-amber-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('matches.avgRating', 'Avg Rating')}</p>
            </div>
            <p className="text-xl font-black text-gray-900 dark:text-white">{stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : matches.length === 0 ? (
        <EmptyState icon={<Trophy size={40} />} title={t('matches.noMatchesSolo', 'No matches logged yet')}
          description={t('matches.noMatchesSoloDesc', 'Record your first match result — score, opponent, and how you rated your own game.')}
          action={{ label: t('matches.logFirstMatch', 'Log First Match'), onClick: () => { setEditMatch(null); setLogOpen(true); } }} />
      ) : (
        <div className="space-y-3">
          {matches.map(m => {
            const upcoming = m.status === 'Scheduled';
            const rs = m.result ? RESULT_STYLES[m.result] : null;
            const unit = scoreUnit(m.scoreFormat);
            const rating = myRating(m);
            const isOpen = expanded === m.id;
            const canExpand = !!m.setScores || !!m.notes;
            return (
              <div key={m.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="text-center flex-shrink-0 w-20">
                    {upcoming || !rs ? (
                      <>
                        {/* An unplayed fixture has NO score — "—", never 0-0. */}
                        <p className="text-2xl font-black tabular-nums text-gray-300 dark:text-gray-600" aria-hidden>—</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                          {t('matches.upcoming', 'Upcoming')}
                        </span>
                      </>
                    ) : (
                      <>
                        {/* dir=ltr: bidi reorders "0 - 1" into "1 - 0" in RTL locales — a reversed scoreline */}
                        <p className={clsx('text-2xl font-black tabular-nums', rs.score)} dir="ltr">{m.ourScore} - {m.opponentScore}</p>
                        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', rs.badge)}>{L.status(m.result!)}{unit ? ` · ${unit}` : ''}</span>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {m.isHome ? t('matches.vs', 'vs') : t('matches.at', '@')} {m.opponentName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{fmtDate(m.matchDate)}</span>
                      {m.competition && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{m.competition}</span>}
                      {m.setScores && <span className="text-[10px] text-gray-400">{m.setScores}</span>}
                    </div>
                  </div>
                  {rating != null && (
                    <div className={clsx('flex flex-col items-center justify-center w-12 h-12 rounded-xl font-black flex-shrink-0', ratingColor(rating))}>
                      <span className="text-base leading-none">{rating.toFixed(1)}</span>
                      <span className="text-[8px] font-semibold uppercase mt-0.5 opacity-70">{t('matches.me', 'me')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditMatch(m); setLogOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                    {canExpand && (
                      <button onClick={() => setExpanded(isOpen ? null : m.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all cursor-pointer">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-1.5">
                    {m.setScores && (
                      <p className="text-xs text-gray-500 dark:text-gray-400"><span className="font-semibold">{t('matches.setScoresLabel', 'Set scores:')}</span> {m.setScores}</p>
                    )}
                    {m.notes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{m.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {playerId && (
        <LogSoloMatchModal sportName={soloProfile?.sportName} playerId={playerId} match={editMatch}
          isOpen={logOpen} onClose={() => { setLogOpen(false); setEditMatch(null); }} />
      )}
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try { await deleteMatch.mutateAsync(deleteTarget.id); addToast(t('matches.matchDeleted', 'Match deleted'), 'success'); }
          catch (err) { addToast(err instanceof Error ? err.message : t('matches.deleteFailed', 'Delete failed'), 'error'); }
          finally { setDeleteTarget(null); }
        }}
        title={t('matches.deleteMatchTitle', 'Delete Match')} message={t('matches.deleteMatchMsg', 'Delete the match vs {{opponent}}?', { opponent: deleteTarget?.opponentName })} confirmLabel={t('common.delete', 'Delete')} isLoading={deleteMatch.isPending} />
    </PageWrapper>
  );
}
