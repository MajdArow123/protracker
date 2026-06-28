import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { ConfirmModal } from '../../components/ui/Modal';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { assessmentsApi } from '../../api/assessmentsApi';
import { useQueryClient } from '@tanstack/react-query';
import type { PlayerAssessment } from '../../types';

type Tab = 'new' | 'history';

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
  const [scores, setScores] = useState<Record<number, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlayerAssessment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    if (statCategories.length > 0) {
      setScores(prev => {
        const next: Record<number, number> = {};
        statCategories.forEach(c => { next[c.id] = prev[c.id] ?? 5; });
        return next;
      });
    }
  }, [statCategories]);

  const teamPeriods = assessmentPeriods.filter(p => !player?.teamId || p.teamId === player.teamId);

  async function submitAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!periodId) { showToast('Select an assessment period', 'error'); return; }
    if (!dateRecorded) { showToast('Select a date', 'error'); return; }

    try {
      await createAssessment.mutateAsync({
        playerId,
        assessmentPeriodId: Number(periodId),
        dateRecorded,
        notes: notes || undefined,
        statScores: statCategories.map(c => ({
          playerAssessmentId: 0,
          sportStatCategoryId: c.id,
          score: scores[c.id] ?? 5,
        })),
      } as Parameters<typeof createAssessment.mutateAsync>[0]);
      showToast('Assessment saved', 'success');
      setTab('history');
      setPeriodId('');
      setNotes('');
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
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t === 'new' ? 'New Assessment' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <form onSubmit={submitAssessment} className="max-w-2xl space-y-6">
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
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={14} /> Create new period
                </button>
              </div>
            )}
          </Card>

          <Card header="Details">
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
                  rows={3}
                  placeholder="Observations…"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          </Card>

          <Card header="Stat Scores">
            {loadingStats ? (
              <Spinner />
            ) : statCategories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No stat categories for this sport.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {statCategories.map(cat => (
                  <div key={cat.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{scores[cat.id] ?? 5}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={scores[cat.id] ?? 5}
                      onChange={e => setScores(prev => ({ ...prev, [cat.id]: Number(e.target.value) }))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>1</span><span>10</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={createAssessment.isPending}>
              Save Assessment
            </Button>
          </div>
        </form>
      )}

      {tab === 'history' && (
        <div className="max-w-3xl space-y-4">
          {existingAssessments.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 py-8 text-center">
              No assessments yet.
            </div>
          ) : (
            existingAssessments.map(a => (
              <Card key={a.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{a.assessmentPeriodName}</p>
                    <p className="text-sm text-gray-500">{a.dateRecorded}</p>
                    {a.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{a.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(a)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                {a.statScores.length > 0 && (
                  <RadarChartWrapper
                    data={a.statScores.map(s => ({ subject: s.statCategoryName, value: s.score }))}
                  />
                )}
              </Card>
            ))
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
              <Input
                label="Period Name"
                value={periodName}
                onChange={e => setPeriodName(e.target.value)}
                placeholder="Spring 2026"
              />
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
