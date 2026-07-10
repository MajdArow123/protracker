import { useMemo, useState } from 'react';
import {
  CalendarRange, Plus, Pencil, Trash2, Star, ArrowRight, TrendingUp, TrendingDown,
  Minus, Link2, ChevronDown, Target,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal, ConfirmModal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import {
  useSeasons, useSeasonSummary, useCreateSeason, useUpdateSeason, useDeleteSeason, useLinkPeriod,
} from '../../hooks/useSeasons';
import { useAssessmentPeriods } from '../../hooks/useAssessmentPeriods';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { Season, CreateSeasonInput } from '../../types';

function ImprovementChip({ value }: { value: number }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const cls = value > 0
    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
    : value < 0
    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
    : 'bg-gray-100 dark:bg-gray-800 text-gray-500';
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', cls)}>
      <Icon size={12} />
      {value > 0 ? '+' : ''}{value.toFixed(1)}
    </span>
  );
}

// --- Season create/edit form ---
function SeasonFormModal({ teamId, editing, onClose }: { teamId: number; editing: Season | null; onClose: () => void }) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const create = useCreateSeason(teamId);
  const update = useUpdateSeason(teamId);
  const [form, setForm] = useState<CreateSeasonInput>({
    name: editing?.name ?? '',
    startDate: editing?.startDate?.slice(0, 10) ?? '',
    endDate: editing?.endDate?.slice(0, 10) ?? '',
    isActive: editing?.isActive ?? false,
    goals: editing?.goals ?? '',
  });

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  async function submit() {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      addToast(tr('seasons.errRequired', 'Name, start and end dates are required.'), 'error');
      return;
    }
    if (form.endDate < form.startDate) {
      addToast(tr('seasons.errEndDate', 'End date must be on or after the start date.'), 'error');
      return;
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form });
      else await create.mutateAsync(form);
      addToast(editing ? tr('seasons.seasonUpdated', 'Season updated') : tr('seasons.seasonCreated', 'Season created'), 'success');
      onClose();
    } catch {
      addToast(tr('seasons.errSave', 'Could not save the season.'), 'error');
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={editing ? tr('seasons.editSeason', 'Edit Season') : tr('seasons.newSeason', 'New Season')}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('common.name', 'Name')}</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder={tr('seasons.namePlaceholder', 'e.g. 2025/26 Season')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.startDate', 'Start date')}</label>
            <input type="date" className={inputClass} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.endDate', 'End date')}</label>
            <input type="date" className={inputClass} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.goals', 'Goals')} <span className="text-gray-400 font-normal">({tr('common.optional', 'Optional')})</span></label>
          <textarea
            className={clsx(inputClass, 'resize-none')}
            rows={3}
            value={form.goals ?? ''}
            onChange={e => setForm({ ...form, goals: e.target.value })}
            placeholder={tr('seasons.goalsPlaceholder', 'What is the team working towards this season?')}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm({ ...form, isActive: e.target.checked })}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{tr('seasons.setActive', 'Set as the current (active) season')}</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button onClick={submit} isLoading={create.isPending || update.isPending}>
            {editing ? tr('seasons.saveChanges', 'Save Changes') : tr('seasons.createSeason', 'Create Season')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Expanded season detail: summary + period linking ---
function SeasonDetail({ teamId, season, isCoach }: { teamId: number; season: Season; isCoach: boolean }) {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const { addToast } = useToast();
  const { data: summary, isLoading } = useSeasonSummary(season.id);
  const { data: periods = [] } = useAssessmentPeriods();
  const linkMut = useLinkPeriod(teamId);

  const teamPeriods = useMemo(
    () => periods.filter(p => p.teamId === teamId).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [periods, teamId],
  );

  async function toggleLink(periodId: number, link: boolean) {
    try {
      await linkMut.mutateAsync({ seasonId: season.id, periodId, link });
    } catch {
      addToast(tr('seasons.errLink', 'Could not update the linked period.'), 'error');
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-4">
      {/* Season summary */}
      {isLoading ? (
        <p className="text-sm text-gray-400">{tr('seasons.loadingSummary', 'Loading summary…')}</p>
      ) : !summary?.hasData ? (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 text-sm text-gray-500 dark:text-gray-400">
          {tr('seasons.noData', 'No assessment data yet. Link assessment periods below (or record assessments within the season dates) to see start-vs-end progress.')}
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{summary.startPeriodName}</p>
                <p className="text-2xl font-black text-gray-700 dark:text-gray-200">{summary.startAverage.toFixed(1)}</p>
              </div>
              <ArrowRight size={18} className="text-gray-400" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">{summary.endPeriodName}</p>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{summary.endAverage.toFixed(1)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-bold mb-1">{tr('seasons.seasonChange', 'Season change')}</p>
              <ImprovementChip value={summary.improvement} />
            </div>
          </div>

          {/* Category trends */}
          {summary.categoryTrends.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {summary.categoryTrends.map(t => (
                <div key={t.category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{t.category}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400 tabular-nums">{t.startAverage.toFixed(1)} → {t.endAverage.toFixed(1)}</span>
                    <ImprovementChip value={t.improvement} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessment period linking */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
          <Link2 size={13} /> {tr('seasons.assessmentPeriods', 'Assessment Periods')}
        </p>
        {teamPeriods.length === 0 ? (
          <p className="text-sm text-gray-400">{tr('seasons.noPeriods', 'This team has no assessment periods yet.')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teamPeriods.map(p => {
              const linkedHere = p.seasonId === season.id;
              const linkedElsewhere = p.seasonId != null && p.seasonId !== season.id;
              return (
                <button
                  key={p.id}
                  disabled={!isCoach || linkedElsewhere || linkMut.isPending}
                  onClick={() => toggleLink(p.id, !linkedHere)}
                  title={linkedElsewhere ? tr('seasons.linkedElsewhere', 'Linked to another season') : undefined}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    linkedHere
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-300',
                    isCoach && !linkedElsewhere ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default opacity-70',
                  )}
                >
                  {linkedHere && <Star size={11} className="fill-current" />}
                  {p.name}
                  <span className="text-gray-400">· {fmtDate(p.startDate)}</span>
                </button>
              );
            })}
          </div>
        )}
        {isCoach && <p className="text-[11px] text-gray-400 mt-2">{tr('seasons.tapToLink', 'Tap a period to link or unlink it from this season.')}</p>}
      </div>
    </div>
  );
}

export function TeamSeasonsSection({ teamId, isCoach }: { teamId: number; isCoach: boolean }) {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const { addToast } = useToast();
  const { data: seasons = [], isLoading } = useSeasons(teamId);
  const del = useDeleteSeason(teamId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Season | null>(null);

  function openNew() { setEditing(null); setShowForm(true); }
  function openEdit(s: Season) { setEditing(s); setShowForm(true); }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      addToast(tr('seasons.seasonDeleted', 'Season deleted'), 'success');
    } catch {
      addToast(tr('seasons.errDelete', 'Could not delete the season.'), 'error');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarRange size={16} className="text-indigo-500" /> {tr('seasons.title', 'Seasons')}
          </span>
          {isCoach && (
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> {tr('seasons.newSeason', 'New Season')}
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-gray-400">{tr('seasons.loadingSeasons', 'Loading seasons…')}</p>
      ) : seasons.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={36} />}
          title={tr('seasons.noSeasons', 'No seasons yet')}
          description={isCoach ? tr('seasons.noSeasonsCoach', 'Create a season to track squad progress from start to finish.') : tr('seasons.noSeasonsAthlete', 'No seasons have been set up for this team.')}
        />
      ) : (
        <div className="space-y-3">
          {seasons.map(s => {
            const expanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className={clsx(
                  'rounded-xl border p-4 transition-colors',
                  s.isActive
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/10'
                    : 'border-gray-200 dark:border-gray-700',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-white">{s.name}</span>
                      {s.isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                          <Star size={9} className="fill-current" /> {tr('seasons.current', 'CURRENT')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {fmtDate(s.startDate)} – {fmtDate(s.endDate)} · {s.linkedPeriodCount} {s.linkedPeriodCount === 1 ? tr('seasons.linkedPeriod', 'linked period') : tr('seasons.linkedPeriods', 'linked periods')}
                    </p>
                    {s.goals && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 flex items-start gap-1.5">
                        <Target size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" /> {s.goals}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isCoach && (
                      <>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.edit', 'Edit')}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.delete', 'Delete')}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button onClick={() => setExpandedId(expanded ? null : s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.expand', 'Expand')}>
                      <ChevronDown size={16} className={clsx('transition-transform', expanded && 'rotate-180')} />
                    </button>
                  </div>
                </div>

                {expanded && <SeasonDetail teamId={teamId} season={s} isCoach={isCoach} />}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <SeasonFormModal teamId={teamId} editing={editing} onClose={() => setShowForm(false)} />}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title={tr('seasons.deleteSeasonTitle', 'Delete season?')}
        message={tr('seasons.deleteSeasonMsg', '"{{name}}" will be removed. Linked assessment periods are kept (just unlinked).', { name: confirmDelete?.name })}
        confirmLabel={tr('common.delete', 'Delete')}
        isLoading={del.isPending}
      />
    </Card>
  );
}
