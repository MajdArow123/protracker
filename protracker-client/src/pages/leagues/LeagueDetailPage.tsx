import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  Trophy, Swords, Medal, ArrowLeft, MapPin, Calendar, Users, Crown, Edit, Trash2,
  Plus, Zap, Check, X, CheckCircle2, Clock,
} from 'lucide-react';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../context/useToast';
import { useAuth } from '../../context/useAuth';
import { sportGradient } from '../../utils/sportColors';
import {
  LEAGUE_STATUS_STYLES, MATCH_STATUS_STYLES, FORM_STYLES, formatLabel, scoreColumnLabels,
} from '../../utils/leagueMeta';
import {
  useLeague, useLeagueMatches, useDeleteLeague, useSetLeagueTeamStatus,
  useGenerateSchedule, useDeleteLeagueMatch,
} from '../../hooks/useLeagues';
import { RegisterTeamModal } from '../../components/leagues/RegisterTeamModal';
import { AddMatchModal } from '../../components/leagues/AddMatchModal';
import { UpdateScoreModal } from '../../components/leagues/UpdateScoreModal';
import { CreateLeagueModal } from '../../components/leagues/CreateLeagueModal';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { LeagueType, LeagueMatch, LeagueTeamStatus } from '../../types';

const TYPE_ICONS: Record<LeagueType, typeof Trophy> = { League: Trophy, Tournament: Swords, Cup: Medal };
type Tab = 'standings' | 'fixtures' | 'teams' | 'rules';

function FormPills({ form }: { form?: string | null }) {
  if (!form) return <span className="text-xs text-gray-300 dark:text-gray-600">–</span>;
  return (
    <div className="flex gap-0.5">
      {form.split('').map((r, i) => (
        <span key={i} className={clsx('w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center', FORM_STYLES[r] ?? 'bg-gray-300')}>{r}</span>
      ))}
    </div>
  );
}

const MEDAL_ROW = ['bg-amber-50 dark:bg-amber-900/10', 'bg-gray-50 dark:bg-gray-800/40', 'bg-orange-50 dark:bg-orange-900/10'];

export function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = Number(id);
  const navigate = useNavigate();
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { formatDate, formatDateTime } = useLocaleFormat();
  const { addToast } = useToast();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';

  const fmtDate = (s?: string | null) => (s ? formatDate(s, { month: 'short', day: 'numeric', year: 'numeric' }) : null);
  const fmtDateTime = (s?: string | null) => (s ? formatDateTime(s, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : tr('leagues.tbd', 'TBD'));

  const { data: league, isLoading } = useLeague(leagueId);
  const { data: matches = [] } = useLeagueMatches(leagueId);
  const deleteLeague = useDeleteLeague();
  const setTeamStatus = useSetLeagueTeamStatus(leagueId);
  const generateSchedule = useGenerateSchedule(leagueId);
  const deleteMatch = useDeleteLeagueMatch(leagueId);

  const [tab, setTab] = useState<Tab>('standings');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [scoreMatch, setScoreMatch] = useState<LeagueMatch | null>(null);
  const [deleteMatchTarget, setDeleteMatchTarget] = useState<LeagueMatch | null>(null);

  if (isLoading) return <DetailSkeleton />;
  if (!league) {
    return (
      <div className="p-6">
        <EmptyState icon={<Trophy size={30} />} title={tr('leagues.leagueNotFound', 'League not found')} description={tr('leagues.leagueNotFoundDesc', 'This league may be private or no longer exists.')}
          action={{ label: tr('leagues.backToLeagues', 'Back to Leagues'), onClick: () => navigate('/leagues') }} />
      </div>
    );
  }

  const Icon = TYPE_ICONS[league.type];
  const grad = sportGradient(league.sportName);
  const cols = scoreColumnLabels(league.scoreFormat);
  const canManage = league.isOrganizer;
  const approvedTeams = league.teams.filter(t => t.status === 'Approved');
  const pendingCount = league.teams.filter(t => t.status === 'Pending').length;

  const setStatus = async (leagueTeamId: number, approve: boolean) => {
    try {
      await setTeamStatus.mutateAsync({ leagueTeamId, approve });
      addToast(approve ? tr('leagues.teamApproved', 'Team approved') : tr('leagues.teamRejected', 'Team rejected'), 'success');
    } catch (e) { addToast(e instanceof Error ? e.message : tr('leagues.failed', 'Failed'), 'error'); }
  };

  const doGenerate = async () => {
    try {
      const res = await generateSchedule.mutateAsync();
      addToast(tr('leagues.generatedMatches', 'Generated {{count}} matches', { count: res.matchesCreated }), 'success');
      setConfirmGenerate(false);
      setTab('fixtures');
    } catch (e) { addToast(e instanceof Error ? e.message : tr('leagues.failed', 'Failed'), 'error'); setConfirmGenerate(false); }
  };

  const doDeleteLeague = async () => {
    try {
      await deleteLeague.mutateAsync(league.id);
      addToast(tr('leagues.leagueDeleted', 'League deleted'), 'success');
      navigate('/leagues');
    } catch (e) { addToast(e instanceof Error ? e.message : tr('leagues.failed', 'Failed'), 'error'); }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'standings', label: tr('leagues.standings', 'Standings') },
    { id: 'fixtures', label: tr('leagues.fixtures', 'Fixtures') },
    { id: 'teams', label: `${tr('leagues.teams', 'Teams')}${pendingCount > 0 && canManage ? ` (${pendingCount})` : ''}` },
    { id: 'rules', label: tr('leagues.rules', 'Rules') },
  ];

  // Group fixtures by round.
  const rounds = Array.from(new Set(matches.map(m => m.round ?? 0))).sort((a, b) => a - b);

  return (
    <div>
      {/* Hero */}
      <div className={clsx('bg-gradient-to-br px-4 lg:px-6 py-6', grad)}>
        <button onClick={() => navigate('/leagues')} className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm mb-4 cursor-pointer">
          <ArrowLeft size={16} /> {tr('leagues.title', 'Leagues')}
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0"><Icon size={26} className="text-white" /></div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-white">{league.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {league.sportName && <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">{L.sport(league.sportName)}</span>}
                <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-xs font-semibold">{L.generic('leagueType', league.type)} · {L.generic('leagueFormat', formatLabel(league.format))}</span>
                <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', LEAGUE_STATUS_STYLES[league.status])}>{L.status(league.status)}</span>
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-white/90 text-xs flex-wrap">
                <span className="flex items-center gap-1"><Crown size={13} /> {league.organizerName}</span>
                <span className="flex items-center gap-1"><Users size={13} /> {approvedTeams.length}{league.maxTeams ? `/${league.maxTeams}` : ''} {tr('leagues.teamsLabel', 'teams')}</span>
                {league.location && <span className="flex items-center gap-1"><MapPin size={13} /> {league.location}</span>}
                {(league.startDate || league.endDate) && <span className="flex items-center gap-1"><Calendar size={13} /> {fmtDate(league.startDate)}{league.endDate ? ` – ${fmtDate(league.endDate)}` : ''}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isCoach && !league.isOrganizer && !league.isRegistered && (
              <button onClick={() => setRegisterOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-gray-900 text-sm font-bold hover:bg-gray-100 cursor-pointer">
                <Plus size={15} /> {tr('leagues.registerTeam', 'Register My Team')}
              </button>
            )}
            {canManage && (
              <>
                <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 cursor-pointer"><Edit size={14} /> {tr('common.edit', 'Edit')}</button>
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-100 text-sm font-medium border border-red-400/30 cursor-pointer"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer',
                tab === t.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {/* Generate schedule banner (organizer, no matches yet) */}
        {canManage && matches.length === 0 && approvedTeams.length >= 2 && (
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-900/10 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Zap size={16} className="text-indigo-500" /> {tr('leagues.generateBanner', 'Ready to start — auto-generate the {{format}} schedule for {{count}} teams.', { format: L.generic('leagueFormat', formatLabel(league.format)), count: approvedTeams.length })}
            </div>
            <button onClick={() => setConfirmGenerate(true)} className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer">{tr('leagues.generateSchedule', 'Generate Schedule')}</button>
          </div>
        )}

        {/* STANDINGS */}
        {tab === 'standings' && (
          league.standings.length === 0 ? (
            <EmptyState icon={<Trophy size={28} />} title={tr('leagues.noStandings', 'No standings yet')} description={tr('leagues.noStandingsDesc', 'Standings appear once teams are approved and matches are played.')} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <th className="px-3 py-2.5 text-left w-10">#</th>
                    <th className="px-3 py-2.5 text-left">{tr('leagues.colTeam', 'Team')}</th>
                    <th className="px-2 py-2.5 text-center">{tr('leagues.colP', 'P')}</th>
                    <th className="px-2 py-2.5 text-center">{tr('leagues.colW', 'W')}</th>
                    <th className="px-2 py-2.5 text-center">{tr('leagues.colD', 'D')}</th>
                    <th className="px-2 py-2.5 text-center">{tr('leagues.colL', 'L')}</th>
                    <th className="px-2 py-2.5 text-center">{cols.for}</th>
                    <th className="px-2 py-2.5 text-center">{cols.against}</th>
                    <th className="px-2 py-2.5 text-center">{tr('leagues.colGD', 'GD')}</th>
                    <th className="px-2 py-2.5 text-center font-bold">{tr('leagues.colPts', 'Pts')}</th>
                    <th className="px-3 py-2.5 text-left">{tr('leagues.colForm', 'Form')}</th>
                  </tr>
                </thead>
                <tbody>
                  {league.standings.map((s, i) => (
                    <tr key={s.leagueTeamId} className={clsx('border-t border-gray-100 dark:border-gray-800',
                      s.isMine ? 'bg-indigo-50 dark:bg-indigo-900/20' : i < 3 ? MEDAL_ROW[i] : '')}>
                      <td className="px-3 py-2.5 font-bold text-gray-500">{s.position}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-white">{s.teamName}{s.isMine && <span className="ml-1.5 text-[10px] text-indigo-500">{tr('leagues.you', '(you)')}</span>}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.played}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.won}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.drawn}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.lost}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.goalsFor}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.goalsAgainst}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 dark:text-gray-300">{s.goalDifference > 0 ? '+' : ''}{s.goalDifference}</td>
                      <td className="px-2 py-2.5 text-center font-bold text-gray-900 dark:text-white">{s.points}</td>
                      <td className="px-3 py-2.5"><FormPills form={s.form} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* FIXTURES */}
        {tab === 'fixtures' && (
          <div>
            {canManage && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setAddMatchOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"><Plus size={13} /> {tr('leagues.addMatch', 'Add Match')}</button>
              </div>
            )}
            {matches.length === 0 ? (
              <EmptyState icon={<Calendar size={28} />} title={tr('leagues.noFixtures', 'No fixtures yet')} description={canManage ? tr('leagues.noFixturesCoach', 'Generate a schedule or add matches manually.') : tr('leagues.noFixturesAthlete', "The organizer hasn't scheduled matches yet.")} />
            ) : (
              <div className="space-y-5">
                {rounds.map(r => (
                  <div key={r}>
                    {r > 0 && <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">{tr('leagues.roundNum', 'Round {{n}}', { n: r })}</h3>}
                    <div className="space-y-2">
                      {matches.filter(m => (m.round ?? 0) === r).map(m => {
                        const done = m.status === 'Completed' && m.homeScore != null;
                        return (
                          <div key={m.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 text-right text-sm font-semibold text-gray-900 dark:text-white truncate">{m.homeTeamName}</div>
                              <div className="flex-shrink-0 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 font-bold text-gray-900 dark:text-white text-sm min-w-[56px] text-center">
                                {done ? `${m.homeScore} – ${m.awayScore}` : tr('leagues.vs', 'vs')}
                              </div>
                              <div className="flex-1 text-left text-sm font-semibold text-gray-900 dark:text-white truncate">{m.awayTeamName}</div>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', MATCH_STATUS_STYLES[m.status])}>{L.generic('matchStatus', m.status)}</span>
                              <span className="flex items-center gap-1 text-[11px] text-gray-400"><Clock size={10} /> {fmtDateTime(m.scheduledAt)}</span>
                              {m.venue && <span className="flex items-center gap-1 text-[11px] text-gray-400"><MapPin size={10} /> {m.venue}</span>}
                              {m.setScores && <span className="text-[11px] text-gray-400">{m.setScores}</span>}
                              {canManage && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setScoreMatch(m)} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold cursor-pointer">{done ? tr('leagues.editScore', 'Edit score') : tr('leagues.updateScoreTitle', 'Update score')}</button>
                                  <button onClick={() => setDeleteMatchTarget(m)} className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEAMS */}
        {tab === 'teams' && (
          league.teams.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title={tr('leagues.noTeams', 'No teams registered')} description={canManage ? tr('leagues.noTeamsCoach', 'Register your team or wait for others to join.') : tr('leagues.noTeamsAthlete', 'Be the first to register a team.')} />
          ) : (
            <div className="space-y-2">
              {league.teams.map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center flex-shrink-0"><Users size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{t.teamName}</span>
                      {t.isMine && <span className="text-[10px] text-indigo-500">{tr('leagues.yours', '(yours)')}</span>}
                    </div>
                    <div className="text-xs text-gray-500">{t.coachName}</div>
                  </div>
                  <TeamStatusBadge status={t.status} />
                  {canManage && t.status === 'Pending' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setStatus(t.id, true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold cursor-pointer"><Check size={13} /> {tr('common.approve', 'Approve')}</button>
                      <button onClick={() => setStatus(t.id, false)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold cursor-pointer"><X size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* RULES */}
        {tab === 'rules' && (
          <div className="space-y-5 max-w-2xl">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr('leagues.format', 'Format')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{L.generic('leagueType', league.type)} · {L.generic('leagueFormat', formatLabel(league.format))}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tr('leagues.pointsLine', 'Points: Win {{win}} · Draw {{draw}} · Loss {{loss}}', { win: league.pointsWin, draw: league.pointsDraw, loss: league.pointsLoss })}</p>
            </div>
            {league.rules && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{tr('leagues.rules', 'Rules')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{league.rules}</p>
              </div>
            )}
            {league.prizeDescription && (
              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5"><Trophy size={16} className="text-amber-500" /> {tr('leagues.prizeHeading', 'Prize')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{league.prizeDescription}</p>
              </div>
            )}
            {!league.rules && !league.prizeDescription && (
              <p className="text-sm text-gray-400">{tr('leagues.noRules', 'No additional rules provided.')}</p>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <RegisterTeamModal league={league} isOpen={registerOpen} onClose={() => setRegisterOpen(false)} />
      <AddMatchModal leagueId={league.id} teams={league.teams} isOpen={addMatchOpen} onClose={() => setAddMatchOpen(false)} />
      <UpdateScoreModal leagueId={league.id} match={scoreMatch} scoreFormat={league.scoreFormat} isOpen={!!scoreMatch} onClose={() => setScoreMatch(null)} />
      <CreateLeagueModal isOpen={editOpen} onClose={() => setEditOpen(false)} editLeague={league} />
      <ConfirmModal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={doDeleteLeague}
        title={tr('leagues.deleteLeagueTitle', 'Delete league')} message={tr('leagues.deleteLeagueMsg', 'Delete "{{name}}"? This removes all teams, fixtures and standings.', { name: league.name })} confirmLabel={tr('common.delete', 'Delete')} isLoading={deleteLeague.isPending} />
      <ConfirmModal isOpen={confirmGenerate} onClose={() => setConfirmGenerate(false)} onConfirm={doGenerate}
        title={tr('leagues.generateScheduleTitle', 'Generate schedule')} message={tr('leagues.generateScheduleMsg', 'Auto-generate the {{format}} schedule for {{count}} approved teams? Any existing unplayed fixtures will be replaced.', { format: L.generic('leagueFormat', formatLabel(league.format)), count: approvedTeams.length })} confirmLabel={tr('leagues.generate', 'Generate')} isLoading={generateSchedule.isPending} />
      <ConfirmModal isOpen={!!deleteMatchTarget} onClose={() => setDeleteMatchTarget(null)}
        onConfirm={async () => { if (!deleteMatchTarget) return; try { await deleteMatch.mutateAsync(deleteMatchTarget.id); addToast(tr('leagues.matchDeleted', 'Match deleted'), 'success'); } catch (e) { addToast(e instanceof Error ? e.message : tr('leagues.failed', 'Failed'), 'error'); } finally { setDeleteMatchTarget(null); } }}
        title={tr('leagues.deleteMatchTitle', 'Delete match')} message={tr('leagues.deleteMatchMsg', 'Delete this match? Standings will recalculate.')} confirmLabel={tr('common.delete', 'Delete')} isLoading={deleteMatch.isPending} />
    </div>
  );
}

function TeamStatusBadge({ status }: { status: LeagueTeamStatus }) {
  const L = useDynamicLabels();
  const cfg: Record<LeagueTeamStatus, { cls: string; icon: typeof Check }> = {
    Approved: { cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
    Pending: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
    Rejected: { cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: X },
  };
  const c = cfg[status];
  const I = c.icon;
  return <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0', c.cls)}><I size={11} /> {L.status(status)}</span>;
}
