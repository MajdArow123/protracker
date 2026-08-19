import { useMemo, useState } from 'react';
import {
  CalendarRange, Plus, Pencil, Trash2, Star, ArrowRight, TrendingUp, TrendingDown,
  Minus, Link2, ChevronDown, Target, Shield, History,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../context/useToast';
import {
  useAllSeasons, useSeasonSummary, useCreateSeason, useUpdateSeason, useDeleteSeason, useLinkPeriod,
} from '../../hooks/useSeasons';
import { useTeams } from '../../hooks/useTeams';
import { useAssessmentPeriods } from '../../hooks/useAssessmentPeriods';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { seasonsApi } from '../../api/seasonsApi';
import { findOverlappingSeasons } from '../../utils/seasonOverlap';
import { SeasonRosterSection } from '../../components/seasons/SeasonRosterSection';
import { SeasonBackfillModal } from '../../components/seasons/SeasonBackfillModal';
import type { Season, CreateSeasonInput, SeasonStatus } from '../../types';

const STATUS_STYLES: Record<SeasonStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  Active: 'bg-indigo-600 text-white',
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function useStatusLabels(): Record<SeasonStatus, string> {
  const { t } = useTranslation();
  return {
    Draft: t('seasons.statusDraft', 'Draft'),
    Active: t('seasons.statusActive', 'Active'),
    Completed: t('seasons.statusCompleted', 'Completed'),
    Archived: t('seasons.statusArchived', 'Archived'),
  };
}

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

// ── Create / edit form with the two non-blocking warnings ────────────────────
function SeasonFormModal({ editing, seasons, onClose }: {
  editing: Season | null; seasons: Season[]; onClose: () => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const statusLabels = useStatusLabels();
  const { data: teams = [] } = useTeams();
  const create = useCreateSeason();
  const update = useUpdateSeason();

  const [form, setForm] = useState<CreateSeasonInput>({
    // Ruling: prefill the NAME only — a confidently wrong date window is worse than
    // none, because users accept prefilled values unread.
    name: editing?.name ?? tr('seasons.defaultName', '{{year}} Season', { year: new Date().getFullYear() }),
    startDate: editing?.startDate?.slice(0, 10) ?? '',
    endDate: editing?.endDate?.slice(0, 10) ?? '',
    status: editing?.status ?? 'Draft',
    goals: editing?.goals ?? '',
  });
  const [teamId, setTeamId] = useState<number | ''>(editing ? '' : teams.length === 1 ? teams[0].id : '');
  const [pendingConfirm, setPendingConfirm] = useState<
    | null
    | { kind: 'overlap'; names: string[] }
    | { kind: 'stamps'; total: number | null }
  >(null);

  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const datesChanged = !!editing && (
    form.startDate !== editing.startDate.slice(0, 10) || form.endDate !== editing.endDate.slice(0, 10)
  );

  async function save() {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form });
      else await create.mutateAsync({ teamId: teamId as number, data: form });
      addToast(editing ? tr('seasons.seasonUpdated', 'Season updated') : tr('seasons.seasonCreated', 'Season created'), 'success');
      onClose();
    } catch {
      addToast(tr('seasons.errSave', 'Could not save the season.'), 'error');
    }
  }

  async function submit(confirmedOverlap = false, confirmedStamps = false) {
    setPendingConfirm(null);
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      addToast(tr('seasons.errRequired', 'Name, start and end dates are required.'), 'error');
      return;
    }
    if (form.endDate < form.startDate) {
      addToast(tr('seasons.errEndDate', 'End date must be on or after the start date.'), 'error');
      return;
    }
    if (!editing && teamId === '') {
      addToast(tr('seasons.errTeamRequired', 'Pick the team this season is for.'), 'error');
      return;
    }
    // Ruling 1: overlaps are allowed — warn (naming the seasons), then proceed on confirm.
    if (!confirmedOverlap) {
      const overlaps = findOverlappingSeasons(seasons, form.startDate, form.endDate, editing?.id);
      if (overlaps.length > 0) {
        setPendingConfirm({ kind: 'overlap', names: overlaps.map(o => o.name) });
        return;
      }
    }
    // Ruling 2: date edits never re-resolve existing stamps (until S7 backfill) — say
    // how many records are stamped before saving. A failed count still warns.
    if (editing && datesChanged && !confirmedStamps) {
      let total: number | null = null;
      try {
        total = (await seasonsApi.getStampedCounts(editing.id)).total;
      } catch {
        total = null;
      }
      if (total === null || total > 0) {
        setPendingConfirm({ kind: 'stamps', total });
        return;
      }
    }
    await save();
  }

  return (
    <>
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
          {!editing && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.team', 'Team')}</label>
              <select
                className={inputClass}
                value={teamId}
                onChange={e => setTeamId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">{tr('seasons.pickTeam', 'Pick a team…')}</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr('seasons.windowExplainer', 'The start and end dates decide which records — matches, sessions, assessments — get assigned to this season.')}
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.status', 'Status')}</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as SeasonStatus })}
            >
              {(Object.keys(STATUS_STYLES) as SeasonStatus[]).map(s => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
            <Button onClick={() => submit()} isLoading={create.isPending || update.isPending}>
              {editing ? tr('seasons.saveChanges', 'Save Changes') : tr('seasons.createSeason', 'Create Season')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Overlap warning — non-blocking by ruling: overlaps are legitimate. */}
      <ConfirmModal
        isOpen={pendingConfirm?.kind === 'overlap'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => submit(true)}
        title={tr('seasons.overlapTitle', 'Overlapping seasons')}
        message={tr(
          'seasons.overlapMsg',
          'These dates overlap with: {{names}}. Overlapping seasons are allowed, but a record dated inside both windows cannot be auto-assigned to either.',
          { names: pendingConfirm?.kind === 'overlap' ? pendingConfirm.names.join(', ') : '' },
        )}
        confirmLabel={tr('seasons.createAnyway', 'Save anyway')}
      />

      {/* Stamped-records warning on date edits (ruling 2). */}
      <ConfirmModal
        isOpen={pendingConfirm?.kind === 'stamps'}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => submit(true, true)}
        title={tr('seasons.stampsTitle', 'Records already assigned')}
        message={
          pendingConfirm?.kind === 'stamps' && pendingConfirm.total !== null
            ? tr(
                'seasons.stampsMsg',
                '{{num}} records are currently assigned to this season. Changing its dates will NOT re-assign them — existing assignments stay as they are until backfill tooling ships.',
                { num: pendingConfirm.total },
              )
            : tr(
                'seasons.stampsMsgUnknown',
                'Records assigned to this season could not be counted right now. Changing its dates will NOT re-assign them — existing assignments stay as they are until backfill tooling ships.',
              )
        }
        confirmLabel={tr('seasons.saveDates', 'Save new dates')}
        isLoading={update.isPending}
      />
    </>
  );
}

// ── Expanded detail: period-linked summary + period linking ──────────────────
// NOTE (two-mechanisms ruling): everything in here is the PERIOD-LINKAGE view. The
// stamp-based counts appear ONLY inside the edit-dates confirm dialog, deliberately
// never beside these averages.
function SeasonDetail({ season, onOpenBackfill }: { season: Season; onOpenBackfill: () => void }) {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const { addToast } = useToast();
  const { data: summary, isLoading } = useSeasonSummary(season.id);
  const { data: periods = [] } = useAssessmentPeriods();
  const linkMut = useLinkPeriod();

  const teamIds = useMemo(() => new Set(season.teams.map(t => t.id)), [season.teams]);
  const seasonPeriods = useMemo(
    () => periods
      .filter(p => p.teamId != null && teamIds.has(p.teamId))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [periods, teamIds],
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

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
          <Link2 size={13} /> {tr('seasons.assessmentPeriods', 'Assessment Periods')}
        </p>
        {seasonPeriods.length === 0 ? (
          <p className="text-sm text-gray-400">{tr('seasons.noPeriodsForTeams', "This season's teams have no assessment periods yet.")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seasonPeriods.map(p => {
              const linkedHere = p.seasonId === season.id;
              const linkedElsewhere = p.seasonId != null && p.seasonId !== season.id;
              return (
                <button
                  key={p.id}
                  disabled={linkedElsewhere || linkMut.isPending}
                  onClick={() => toggleLink(p.id, !linkedHere)}
                  title={linkedElsewhere ? tr('seasons.linkedElsewhere', 'Linked to another season') : undefined}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    linkedHere
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-600 dark:text-gray-300',
                    !linkedElsewhere ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default opacity-70',
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
        <p className="text-[11px] text-gray-400 mt-2">{tr('seasons.tapToLink', 'Tap a period to link or unlink it from this season.')}</p>
      </div>

      {/* S6: roster history — who was on which team during this season. */}
      <SeasonRosterSection season={season} onOpenBackfill={onOpenBackfill} />
    </div>
  );
}

// ── The account-level page ───────────────────────────────────────────────────
export function SeasonsPage() {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const { addToast } = useToast();
  const statusLabels = useStatusLabels();
  const { data: seasons = [], isLoading, isError, refetch } = useAllSeasons();
  const del = useDeleteSeason();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Season | null>(null);
  const [showBackfill, setShowBackfill] = useState(false);

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
    <PageWrapper
      title={tr('seasons.title', 'Seasons')}
      actions={
        seasons.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowBackfill(true)}>
              <History size={14} /> {tr('seasons.backfill.action', 'Backfill historical records')}
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> {tr('seasons.newSeason', 'New Season')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : seasons.length === 0 ? (
        // Ruling 3: the empty state is the PRIMARY path — onboarding, not a failure.
        <div className="max-w-xl mx-auto text-center rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 px-6 py-12">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <CalendarRange size={22} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {tr('seasons.onboardTitle', 'Organize your work into seasons')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            {tr('seasons.onboardBody', 'A season is a named date window — a league year, an indoor winter, a summer tournament. Matches, sessions and assessments recorded inside the window are assigned to it, so you can compare one season against the next.')}
          </p>
          <Button className="mt-6" onClick={openNew}>
            <Plus size={16} /> {tr('seasons.createFirst', 'Create your first season')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map(s => {
            const expanded = expandedId === s.id;
            const isActive = s.status === 'Active';
            return (
              <div
                key={s.id}
                className={clsx(
                  'rounded-xl border p-4 transition-colors bg-white dark:bg-gray-900',
                  isActive
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
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_STYLES[s.status])}>
                        {isActive && <Star size={9} className="fill-current" />}
                        {statusLabels[s.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {fmtDate(s.startDate)} – {fmtDate(s.endDate)} · {s.linkedPeriodCount} {s.linkedPeriodCount === 1 ? tr('seasons.linkedPeriod', 'linked period') : tr('seasons.linkedPeriods', 'linked periods')}
                    </p>
                    {s.teams.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                        <Shield size={12} className="text-indigo-400 flex-shrink-0" />
                        {s.teams.map(t => t.name).join(' · ')}
                      </p>
                    )}
                    {s.goals && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 flex items-start gap-1.5">
                        <Target size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" /> {s.goals}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.edit', 'Edit')}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.delete', 'Delete')}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" aria-label={tr('common.expand', 'Expand')}>
                      <ChevronDown size={16} className={clsx('transition-transform', expanded && 'rotate-180')} />
                    </button>
                  </div>
                </div>

                {expanded && <SeasonDetail season={s} onOpenBackfill={() => setShowBackfill(true)} />}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <SeasonFormModal editing={editing} seasons={seasons} onClose={() => setShowForm(false)} />}
      {showBackfill && <SeasonBackfillModal onClose={() => setShowBackfill(false)} />}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title={tr('seasons.deleteSeasonTitle', 'Delete season?')}
        message={tr('seasons.deleteSeasonMsg', '"{{name}}" will be removed. Linked assessment periods are kept (just unlinked).', { name: confirmDelete?.name })}
        confirmLabel={tr('common.delete', 'Delete')}
        isLoading={del.isPending}
      />
    </PageWrapper>
  );
}
