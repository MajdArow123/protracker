import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { PageSpinner, Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { usePlayer } from '../../hooks/usePlayers';
import { useStatCategories } from '../../hooks/useSports';
import { useAssessmentPeriods, useCreateAssessmentPeriod } from '../../hooks/useAssessmentPeriods';
import { useCreateAssessment, usePlayerAssessments } from '../../hooks/useAssessments';
import { ConfirmModal } from '../../components/ui/Modal';
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Minus, Calendar, Trophy, AlertTriangle, BarChart3 } from 'lucide-react';
import { assessmentsApi } from '../../api/assessmentsApi';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { PlayerAssessment } from '../../types';

type Tab = 'new' | 'history';

function scoreColor(score: number) {
  if (score > 7) return '#10b981';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number) {
  if (score > 7) return { text: 'Good', cls: 'text-green-500 bg-green-500/10' };
  if (score >= 5) return { text: 'Fair', cls: 'text-amber-500 bg-amber-500/10' };
  return { text: 'Low', cls: 'text-red-500 bg-red-500/10' };
}

function pct(from: number, to: number) {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

function avgOf(a: PlayerAssessment): number | null {
  return a.statScores.length ? a.statScores.reduce((s, x) => s + x.score, 0) / a.statScores.length : null;
}

interface ScoreSliderProps {
  name: string;
  description?: string;
  value: number | null;
  onChange: (v: number) => void;
}

function ScoreSlider({ name, description, value, onChange }: ScoreSliderProps) {
  const isSet = value !== null;
  const display = value ?? 5.5;
  const color = isSet ? scoreColor(display) : '#9ca3af';
  const label = isSet ? scoreLabel(display) : null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{name}</p>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {label ? (
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold', label.cls)}>{label.text}</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800">Not scored</span>
          )}
          <span className="text-xl font-black" style={{ color }}>{isSet ? display : '—'}</span>
          <span className="text-xs text-gray-400">/10</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={display}
        onChange={e => onChange(Number(e.target.value))}
        className="score-slider"
        style={{ '--thumb-color': color } as React.CSSProperties}
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
        <span>1 — Poor</span>
        <span>10 — Excellent</span>
      </div>
    </div>
  );
}

function OverallScoreRing({ scores, total }: { scores: Record<number, number | null>; total: number }) {
  const vals = Object.values(scores).filter((v): v is number => v !== null);
  const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const color = vals.length > 0 ? scoreColor(avg) : '#9ca3af';
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = (avg / 10) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
          <circle
            cx="48" cy="48" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={circumference / 4}
            style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{vals.length > 0 ? avg.toFixed(1) : '—'}</span>
          <span className="text-[10px] text-gray-400">avg</span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2">Overall Score</p>
      <p className="text-xs text-gray-500">{vals.length}/{total} scored</p>
    </div>
  );
}

export function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();
  const qc = useQueryClient();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: assessmentPeriods = [], isLoading: loadingPeriods } = useAssessmentPeriods();
  const { data: existingAssessments = [] } = usePlayerAssessments(playerId);
  const { data: statCategories = [], isLoading: loadingStats } = useStatCategories(player?.sportId);
  const createAssessment = useCreateAssessment();
  const createPeriod = useCreateAssessmentPeriod();

  const [tab, setTab] = useState<Tab>('new');
  const [periodId, setPeriodId] = useState('');
  const [dateRecorded, setDateRecorded] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<number, number | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlayerAssessment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    if (statCategories.length > 0) {
      setScores(prev => {
        const next: Record<number, number | null> = {};
        statCategories.forEach(c => { next[c.id] = prev[c.id] ?? null; });
        return next;
      });
    }
  }, [statCategories]);

  const teamPeriods = assessmentPeriods.filter(p => !player?.teamId || p.teamId === player.teamId);
  const allScored = statCategories.length > 0 && statCategories.every(c => scores[c.id] !== null && scores[c.id] !== undefined);

  async function submitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId) { showToast('Select an assessment period', 'error'); return; }
    if (!dateRecorded) { showToast('Select a date', 'error'); return; }
    if (!allScored) { showToast('Score every category before submitting', 'error'); return; }

    try {
      await createAssessment.mutateAsync({
        playerId,
        assessmentPeriodId: Number(periodId),
        dateRecorded,
        notes: notes || undefined,
        statScores: statCategories.map(c => ({
          playerAssessmentId: 0,
          sportStatCategoryId: c.id,
          score: scores[c.id] as number,
        })),
      } as Parameters<typeof createAssessment.mutateAsync>[0]);
      showToast('Assessment saved', 'success');
      setTab('history');
      setPeriodId('');
      setNotes('');
      setScores(prev => {
        const next: Record<number, number | null> = {};
        Object.keys(prev).forEach(k => { next[Number(k)] = null; });
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    }
  }

  async function createNewPeriod() {
    if (!periodName.trim() || !periodStart || !periodEnd) {
      showToast('All period fields required', 'error');
      return;
    }
    if (!player?.teamId) {
      showToast('Player must be on a team to create assessment periods', 'error');
      return;
    }
    try {
      const created = await createPeriod.mutateAsync({
        name: periodName.trim(),
        startDate: periodStart,
        endDate: periodEnd,
        teamId: player.teamId,
      });
      showToast('Assessment period created', 'success');
      setPeriodId(String(created.id));
      setShowPeriodModal(false);
      setPeriodName('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await assessmentsApi.deleteAssessment(deleteTarget.id);
      qc.invalidateQueries({ queryKey: ['assessments', playerId] });
      showToast('Assessment deleted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // Sort assessments oldest→newest for trend calcs
  const sorted = useMemo(() =>
    [...existingAssessments].sort((a, b) =>
      new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
    ), [existingAssessments]);

  // History summary metrics
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

  if (loadingPlayer) return <PageSpinner />;

  return (
    <PageWrapper
      title={`Assessments — ${player?.fullName ?? ''}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(`/players/${id}`)}>
          <ArrowLeft size={16} /> Back
        </Button>
      }
    >
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
            {t === 'new' ? 'New Assessment' : `History (${existingAssessments.length})`}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <form onSubmit={submitAssessment} className="max-w-3xl space-y-4">
          <Card header="Assessment Period">
            {loadingPeriods ? (
              <Spinner />
            ) : (
              <div className="space-y-3">
                <Select
                  label="Period"
                  value={periodId}
                  onChange={e => setPeriodId(e.target.value)}
                  options={[
                    { value: '', label: 'Select period…' },
                    ...teamPeriods.map(p => ({
                      value: String(p.id),
                      label: `${p.name} (${p.startDate} → ${p.endDate})`,
                    })),
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setShowPeriodModal(true)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Create new period
                </button>
              </div>
            )}
          </Card>

          <Card header="Date & Notes">
            <div className="space-y-4">
              <Input
                label="Date"
                type="date"
                value={dateRecorded}
                onChange={e => setDateRecorded(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observations…"
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
              Stat Scores
            </h3>
            {loadingStats ? (
              <Spinner />
            ) : statCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No stat categories for this sport.</p>
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
            Submit Assessment
          </Button>
        </form>
      )}

      {tab === 'history' && (
        <div className="max-w-3xl space-y-4">
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={13} className="text-indigo-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assessments</p>
                </div>
                <p className="text-xl font-black text-gray-900 dark:text-white">{summary.total}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={13} className="text-indigo-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Improvement</p>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Best</p>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Weakest</p>
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
              <p className="font-medium">No assessments yet</p>
              <p className="text-sm mt-1">Switch to "New Assessment" to record the first one.</p>
            </div>
          ) : (
            [...existingAssessments]
              .sort((a, b) => new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime())
              .map(a => {
                // Find previous assessment for trend
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
                    {/* Timeline header */}
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{a.assessmentPeriodName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(a.dateRecorded).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Mini horizontal score bars */}
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

      {showPeriodModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowPeriodModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Assessment Period</h2>
            <div className="space-y-3">
              <Input label="Period Name" value={periodName} onChange={e => setPeriodName(e.target.value)} placeholder="Spring 2026" />
              <Input label="Start Date" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              <Input label="End Date" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <Button variant="secondary" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
              <Button onClick={createNewPeriod} isLoading={createPeriod.isPending}>Create</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Assessment"
        message={`Delete assessment from "${deleteTarget?.assessmentPeriodName}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </PageWrapper>
  );
}
