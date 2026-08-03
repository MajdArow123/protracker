import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowLeft, ChevronDown, ChevronUp, Check, Users, Calendar, ClipboardCheck,
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { DetailSkeleton } from '../../components/ui/Skeleton';
import { ScoreSlider, OverallScoreRing } from '../../components/assessments/ScoreWidgets';
import { scoreColor } from '../../components/assessments/scoreDisplay';
import { useTeam } from '../../hooks/useTeams';
import { usePlayers } from '../../hooks/usePlayers';
import { useStatCategories } from '../../hooks/useSports';
import { useAssessmentPeriods } from '../../hooks/useAssessmentPeriods';
import { useBulkCreateAssessment } from '../../hooks/useAssessments';
import { useToast } from '../../context/useToast';

type Scores = Record<number, Record<number, number | null>>; // playerId -> catId -> score
type Notes = Record<number, string>;
type Done = Record<number, boolean>;

interface Saved { periodId: number | ''; date: string; scores: Scores; notes: Notes; done: Done; }

function overallOf(playerScores: Record<number, number | null> | undefined): number | null {
  if (!playerScores) return null;
  const vals = Object.values(playerScores).filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function BulkAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToast } = useToast();

  const { data: team, isLoading: loadingTeam } = useTeam(teamId);
  const { data: allPlayers = [] } = usePlayers();
  const { data: statCategories = [] } = useStatCategories(team?.sportId);
  const { data: periods = [] } = useAssessmentPeriods();
  const bulkCreate = useBulkCreateAssessment();

  const teamPlayers = useMemo(() => allPlayers.filter(p => p.teamId === teamId), [allPlayers, teamId]);
  const teamPeriods = useMemo(() => periods.filter(p => p.teamId === teamId), [periods, teamId]);
  const storageKey = `pd_bulk_${teamId}`;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [periodId, setPeriodId] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Scores>({});
  const [notes, setNotes] = useState<Notes>({});
  const [done, setDone] = useState<Done>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore any in-progress work from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        setPeriodId(s.periodId ?? '');
        if (s.date) setDate(s.date);
        setScores(s.scores ?? {});
        setNotes(s.notes ?? {});
        setDone(s.done ?? {});
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  // Auto-save on every change (once hydrated so we don't clobber the restore).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify({ periodId, date, scores, notes, done } as Saved));
  }, [hydrated, storageKey, periodId, date, scores, notes, done]);

  function setScore(playerId: number, catId: number, value: number) {
    setScores(prev => ({ ...prev, [playerId]: { ...prev[playerId], [catId]: value } }));
  }

  const isAssessed = (pid: number) => done[pid] || Object.values(scores[pid] ?? {}).some(v => v != null);
  const assessedCount = teamPlayers.filter(p => isAssessed(p.id)).length;

  async function submit() {
    const payloadAssessments = teamPlayers
      .filter(p => isAssessed(p.id))
      .map(p => ({
        playerId: p.id,
        notes: notes[p.id]?.trim() || null,
        statScores: statCategories
          .filter(c => scores[p.id]?.[c.id] != null)
          .map(c => ({ sportStatCategoryId: c.id, score: scores[p.id][c.id] as number })),
      }))
      .filter(a => a.statScores.length > 0);

    if (payloadAssessments.length === 0) { addToast(t('assessment.assessOneFirst', 'Assess at least one player first'), 'error'); return; }
    if (!periodId) { addToast(t('assessment.selectPeriodError', 'Select an assessment period'), 'error'); return; }

    try {
      await bulkCreate.mutateAsync({ assessmentPeriodId: Number(periodId), dateRecorded: date, assessments: payloadAssessments });
      localStorage.removeItem(storageKey);
      addToast(`${payloadAssessments.length} ${payloadAssessments.length === 1 ? t('assessment.player', 'player') : t('assessment.players', 'players')} ${t('assessment.assessedCelebration', 'assessed! 🎉')}`, 'success');
      navigate(`/teams/${teamId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('assessment.submitFailed', 'Failed to submit assessments'), 'error');
    }
  }

  if (loadingTeam) return <PageWrapper title={t('assessment.bulkAssessment', 'Bulk Assessment')}><DetailSkeleton /></PageWrapper>;
  if (!team) return <PageWrapper title={t('assessment.bulkAssessment', 'Bulk Assessment')}><EmptyState icon={<Users />} title={t('assessment.teamNotFound', 'Team not found')} /></PageWrapper>;

  const backBtn = (
    <button onClick={() => navigate(`/teams/${teamId}`)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
      <ArrowLeft size={16} /> {team.name}
    </button>
  );

  return (
    <PageWrapper title={t('assessment.assessTeam', 'Assess {{name}}', { name: team.name })} actions={backBtn}>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[{ n: 1, label: t('assessment.stepPeriodDate', 'Period & Date') }, { n: 2, label: t('assessment.stepAssessPlayers', 'Assess Players') }, { n: 3, label: t('assessment.stepReview', 'Review') }].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
              step >= n ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700')}>{n}</span>
            <span className={clsx('text-sm font-medium hidden sm:inline', step >= n ? 'text-gray-900 dark:text-white' : 'text-gray-400')}>{label}</span>
            {i < 2 && <span className="w-8 h-px bg-gray-200 dark:bg-gray-700 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 — period & date */}
      {step === 1 && (
        <div className="max-w-md space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><Calendar size={15} /> {t('assessment.period', 'Assessment Period')}</label>
            {teamPeriods.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('assessment.noPeriodsYet', "No assessment periods yet. Create one from a player's assessment page first.")}</p>
            ) : (
              <select value={periodId} onChange={e => setPeriodId(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white">
                <option value="">{t('assessment.selectAPeriod', 'Select a period…')}</option>
                {teamPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('assessment.dateRecorded', 'Date recorded')}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Users size={15} /> {t('assessment.playersOnTeam', '{{count}} players on {{name}}', { count: teamPlayers.length, name: team.name })}
          </div>
          <Button onClick={() => setStep(2)} disabled={!periodId || teamPlayers.length === 0}>{t('assessment.continue', 'Continue')}</Button>
        </div>
      )}

      {/* Step 2 — assess players */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{assessedCount}</span> {t('assessment.ofPlayersAssessed', 'of {{total}} players assessed', { total: teamPlayers.length })}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>{t('common.back', 'Back')}</Button>
              <Button onClick={() => setStep(3)}>{t('assessment.reviewAndSubmit', 'Review & Submit')}</Button>
            </div>
          </div>
          <div className="space-y-2.5">
            {teamPlayers.map(p => {
              const pScores = scores[p.id] ?? {};
              const overall = overallOf(pScores);
              const open = expanded === p.id;
              const complete = done[p.id];
              return (
                <div key={p.id} className={clsx('rounded-2xl border bg-white dark:bg-gray-900 transition-colors',
                  complete ? 'border-green-300 dark:border-green-800' : 'border-gray-200 dark:border-gray-800')}>
                  {/* Row header */}
                  <button onClick={() => setExpanded(open ? null : p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {p.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.positionName}</p>
                    </div>
                    {overall != null && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: scoreColor(overall), background: `${scoreColor(overall)}1a` }}>
                        {overall.toFixed(1)}
                      </span>
                    )}
                    {complete && <Check size={16} className="text-green-500" />}
                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>

                  {/* Expanded sliders */}
                  {open && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                      <div className="flex items-start gap-4 mb-4">
                        <OverallScoreRing scores={pScores} total={statCategories.length} />
                        <div className="flex-1">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('assessment.notesOptional', 'Notes (optional)')}</label>
                          <textarea rows={2} value={notes[p.id] ?? ''} onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder={t('assessment.anyObservations', 'Any observations…')}
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        {statCategories.map(c => (
                          <ScoreSlider key={c.id} name={c.name} description={c.description ?? undefined}
                            value={pScores[c.id] ?? null} onChange={v => setScore(p.id, c.id, v)} />
                        ))}
                      </div>
                      <label className="flex items-center gap-2 mt-4 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={!!complete}
                          onChange={e => { setDone(prev => ({ ...prev, [p.id]: e.target.checked })); if (e.target.checked) setExpanded(null); }}
                          className="w-4 h-4 rounded accent-green-600" />
                        {t('assessment.markAsDone', 'Mark as done')}
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — review & submit */}
      {step === 3 && (
        <div className="max-w-2xl">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">{t('assessment.stepReview', 'Review')}</h2>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500">
                <tr><th className="px-4 py-2.5 font-medium">{t('assessment.colPlayer', 'Player')}</th><th className="px-4 py-2.5 font-medium">{t('assessment.colOverall', 'Overall')}</th><th className="px-4 py-2.5 font-medium text-right">{t('common.status', 'Status')}</th></tr>
              </thead>
              <tbody>
                {teamPlayers.map(p => {
                  const overall = overallOf(scores[p.id]);
                  const assessed = isAssessed(p.id) && overall != null;
                  return (
                    <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2.5 text-gray-900 dark:text-white">{p.fullName}</td>
                      <td className="px-4 py-2.5">
                        {overall != null
                          ? <span className="font-semibold" style={{ color: scoreColor(overall) }}>{overall.toFixed(1)}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold',
                          assessed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700')}>
                          {assessed ? t('assessment.assessed', 'Assessed') : t('assessment.skipped', 'Skipped')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-5">
            <Button variant="ghost" onClick={() => setStep(2)}>{t('ui.goBack', 'Go Back')}</Button>
            <Button onClick={submit} disabled={bulkCreate.isPending || assessedCount === 0}>
              <ClipboardCheck size={16} className="mr-1.5" /> {bulkCreate.isPending ? t('assessment.submitting', 'Submitting…') : t('assessment.submitAll', 'Submit All ({{count}})', { count: assessedCount })}
            </Button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
