import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageSpinner, Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayer } from '../../hooks/usePlayers';
import { useStatCategories } from '../../hooks/useSports';
import { useCreateAssessment, usePlayerAssessments } from '../../hooks/useAssessments';
import { ConfirmModal } from '../../components/ui/Modal';
import { Trash2, TrendingUp, TrendingDown, Minus, Calendar, Trophy, AlertTriangle, BarChart3, Sparkles } from 'lucide-react';
import { assessmentsApi } from '../../api/assessmentsApi';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ScoreSlider, OverallScoreRing, scoreColor } from '../../components/assessments/ScoreWidgets';
import type { PlayerAssessment } from '../../types';

type Tab = 'new' | 'history';

function pct(from: number, to: number) {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

function avgOf(a: PlayerAssessment): number | null {
  return a.statScores.length ? a.statScores.reduce((s, x) => s + x.score, 0) / a.statScores.length : null;
}

// Self-assessment for solo athletes: same gradient sliders and live score ring the
// coach flow uses, but always for yourself — no player selector, no period picker
// (assessments land in an auto-created "Personal Training" period).
export function SoloAssessmentPage() {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const { addToast: showToast } = useToast();
  const qc = useQueryClient();

  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId ?? 0);
  const { data: existingAssessments = [] } = usePlayerAssessments(playerId);
  const { data: statCategories = [], isLoading: loadingStats } = useStatCategories(player?.sportId);
  const createAssessment = useCreateAssessment();

  const [tab, setTab] = useState<Tab>('new');
  const [dateRecorded, setDateRecorded] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<number, number | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlayerAssessment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (statCategories.length > 0) {
      setScores(prev => {
        const next: Record<number, number | null> = {};
        statCategories.forEach(c => { next[c.id] = prev[c.id] ?? null; });
        return next;
      });
    }
  }, [statCategories]);

  const allScored = statCategories.length > 0 && statCategories.every(c => scores[c.id] !== null && scores[c.id] !== undefined);

  async function submitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!playerId) return;
    if (!dateRecorded) { showToast(tr('assessment.selectDateError', 'Select a date'), 'error'); return; }
    if (!allScored) { showToast(tr('assessment.scoreAllSaveError', 'Score every category before saving'), 'error'); return; }

    try {
      await createAssessment.mutateAsync({
        playerId,
        // 0 = the backend files this under your auto-created "Personal Training" period.
        assessmentPeriodId: 0,
        dateRecorded,
        notes: notes || undefined,
        statScores: statCategories.map(c => ({
          playerAssessmentId: 0,
          sportStatCategoryId: c.id,
          score: scores[c.id] as number,
        })),
      } as Parameters<typeof createAssessment.mutateAsync>[0]);
      showToast(tr('assessment.soloSaved', 'Assessment saved — nice work!'), 'success');
      setTab('history');
      setNotes('');
      setScores(prev => {
        const next: Record<number, number | null> = {};
        Object.keys(prev).forEach(k => { next[Number(k)] = null; });
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : tr('assessment.saveFailed', 'Failed to save'), 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assessmentsApi.deleteAssessment(deleteTarget.id);
      qc.invalidateQueries({ queryKey: ['assessments', playerId] });
      showToast(tr('assessment.deleted', 'Assessment deleted'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : tr('assessment.deleteFailed', 'Failed to delete'), 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const sorted = useMemo(() =>
    [...existingAssessments].sort((a, b) =>
      new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
    ), [existingAssessments]);

  const summary = useMemo(() => {
    if (sorted.length === 0) return null;
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const firstAvg = avgOf(first);
    const latestAvg = avgOf(latest);
    const improvement = firstAvg !== null && latestAvg !== null ? pct(firstAvg, latestAvg) : null;

    const scores = latest.statScores;
    const bestScore = scores.length > 0 ? scores.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    const worstScore = scores.length > 0 ? scores.reduce((a, b) => (b.score < a.score ? b : a)) : null;
    const best = bestScore ? { name: bestScore.statCategoryName, score: bestScore.score } : null;
    const worst = worstScore ? { name: worstScore.statCategoryName, score: worstScore.score } : null;

    return { total: sorted.length, improvement, best, worst };
  }, [sorted]);

  if (loadingId || loadingPlayer) return <PageSpinner />;

  return (
    <PageWrapper title={tr('assessment.myAssessment', 'My Assessment')}>
      <div className="flex gap-2 mb-6">
        {(['new', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t === 'new' ? tr('assessment.logMyAssessment', 'Log My Assessment') : tr('assessment.historyCount', 'History ({{count}})', { count: existingAssessments.length })}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <form onSubmit={submitAssessment} className="max-w-3xl space-y-4">
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 flex-shrink-0">
              <Sparkles size={16} className="text-indigo-500" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tr('assessment.soloHonesty', "Be honest with yourself — this is how you'll see real progress over time. Score every {{position}}category from 1 to 10.", { position: player?.positionName ? `${player.positionName.toLowerCase()} ` : '' })}
            </p>
          </div>

          <Card header={tr('assessment.dateAndNotes', 'Date & Notes')}>
            <div className="space-y-4">
              <Input
                label={tr('assessment.date', 'Date')}
                type="date"
                value={dateRecorded}
                onChange={e => setDateRecorded(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('assessment.notes', 'Notes')}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder={tr('assessment.howDidTodayFeel', "How did today feel? What went well, what didn't…")}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Live overall score ring */}
          {!loadingStats && statCategories.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
              <OverallScoreRing scores={scores} total={statCategories.length} />
            </div>
          )}

          {/* Stat score cards */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {tr('assessment.statScores', 'Stat Scores')}
            </h3>
            {loadingStats ? (
              <Spinner />
            ) : statCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr('assessment.noStatCategories', 'No stat categories for this sport.')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {statCategories.map(cat => (
                  <ScoreSlider
                    key={cat.id}
                    name={cat.name}
                    description={cat.description}
                    value={scores[cat.id] ?? null}
                    onChange={v => setScores(prev => ({ ...prev, [cat.id]: v }))}
                  />
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            isLoading={createAssessment.isPending}
            disabled={!allScored}
            className="w-full justify-center"
          >
            {tr('assessment.saveAssessment', 'Save Assessment')}
          </Button>
        </form>
      )}

      {tab === 'history' && (
        <div className="max-w-3xl space-y-4">
          <Button size="sm" onClick={() => setTab('new')} className="mb-1">
            <Sparkles size={14} /> {tr('assessment.addAssessment', 'Add Assessment')}
          </Button>

          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={13} className="text-indigo-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.count', 'Assessments')}</p>
                </div>
                <p className="text-xl font-black text-gray-900 dark:text-white">{summary.total}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={13} className="text-indigo-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.improvement', 'Improvement')}</p>
                </div>
                {summary.improvement !== null ? (
                  <p className={clsx('text-xl font-black', summary.improvement >= 0 ? 'text-green-500' : 'text-red-500')}>
                    {summary.improvement > 0 ? '+' : ''}{summary.improvement.toFixed(0)}%
                  </p>
                ) : <p className="text-xl font-black text-gray-400">—</p>}
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={13} className="text-green-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.best', 'Best')}</p>
                </div>
                {summary.best ? (
                  <>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{summary.best.name}</p>
                    <p className="text-xs text-green-500 font-semibold">{summary.best.score}/10</p>
                  </>
                ) : <p className="text-xl font-black text-gray-400">—</p>}
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={13} className="text-amber-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{tr('assessment.weakest', 'Weakest')}</p>
                </div>
                {summary.worst ? (
                  <>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{summary.worst.name}</p>
                    <p className="text-xs text-amber-500 font-semibold">{summary.worst.score}/10</p>
                  </>
                ) : <p className="text-xl font-black text-gray-400">—</p>}
              </div>
            </div>
          )}

          {existingAssessments.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 py-12 text-center">
              <Calendar size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="font-medium">{tr('assessment.noAssessments', 'No assessments yet')}</p>
              <p className="text-sm mt-1">{tr('assessment.noAssessmentsSoloDesc', 'Log your first self-assessment to start tracking progress.')}</p>
            </div>
          ) : (
            [...existingAssessments]
              .sort((a, b) => new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime())
              .map(a => {
                const sortedIdx = sorted.findIndex(s => s.id === a.id);
                const prev = sortedIdx > 0 ? sorted[sortedIdx - 1] : null;
                const avgCurr = avgOf(a);
                const avgPrev = prev ? avgOf(prev) : null;
                const trend = avgCurr !== null && avgPrev !== null ? pct(avgPrev, avgCurr) : null;
                const isExpanded = expandedId === a.id;
                const borderColor = !prev ? '#9ca3af' : trend !== null && trend > 0 ? '#10b981' : trend !== null && trend < 0 ? '#ef4444' : '#9ca3af';

                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden border-l-4"
                    style={{ borderLeftColor: borderColor }}
                  >
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{a.assessmentPeriodName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDate(a.dateRecorded, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        {a.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{a.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {avgCurr !== null && (
                          <span className="text-lg font-black" style={{ color: scoreColor(avgCurr) }}>
                            {avgCurr.toFixed(1)}
                          </span>
                        )}
                        {trend !== null && (
                          <span className={clsx(
                            'flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
                            trend > 0 ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : trend < 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-gray-500 bg-gray-100 dark:bg-gray-800'
                          )}>
                            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                            {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          {isExpanded ? tr('common.collapse', 'Collapse') : tr('common.expand', 'Expand')}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {a.statScores.length > 0 && (
                      <div className="px-4 pb-4 space-y-1.5">
                        {a.statScores.map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 truncate">{s.statCategoryName}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${(s.score / 10) * 100}%`, background: scoreColor(s.score) }}
                              />
                            </div>
                            <span className="text-xs font-bold w-7 text-right flex-shrink-0" style={{ color: scoreColor(s.score) }}>
                              {s.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
                        >
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {a.statScores.map(s => (
                              <div
                                key={s.id}
                                className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                                style={{ background: `${scoreColor(s.score)}18`, border: `1px solid ${scoreColor(s.score)}40` }}
                              >
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.statCategoryName}</span>
                                <span className="text-sm font-black flex-shrink-0" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={tr('assessment.deleteTitle', 'Delete Assessment')}
        message={tr('assessment.deleteMessageSolo', 'Delete your assessment from {{date}}? This cannot be undone.', { date: deleteTarget ? formatDate(deleteTarget.dateRecorded) : '' })}
        confirmLabel={tr('common.delete', 'Delete')}
        isLoading={deleting}
      />
    </PageWrapper>
  );
}
