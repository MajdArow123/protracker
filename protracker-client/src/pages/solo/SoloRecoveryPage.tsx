import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Activity, Calendar, Edit2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { ConfirmModal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useToast } from '../../context/useToast';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { useInjuries, useCreateInjury, useUpdateInjury, useDeleteInjury, useRecoverInjury } from '../../hooks/useInjuries';
import { usePlayerRecoveryPlan } from '../../hooks/useRecovery';
import { RecoveryPlanModal } from '../../components/recovery/RecoveryPlanModal';
import { useDynamicLabels } from '../../i18n/dynamicLabels';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { InjuryRecord, InjurySeverity, RecoveryStatus } from '../../types';

const INJURY_SEVERITIES = ['Minor', 'Moderate', 'Severe'] as const;
const RECOVERY_STATUSES = ['Active', 'Recovering', 'FullyRecovered'] as const;
const BODY_PARTS = ['Knee', 'Ankle', 'Shoulder', 'Back', 'Hamstring', 'Quad', 'Calf', 'Hip', 'Wrist', 'Other'] as const;

const SEVERITY_STYLES: Record<string, string> = {
  Minor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const RECOVERY_STYLES: Record<string, string> = {
  Active: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Recovering: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FullyRecovered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const TEXTAREA_CLS = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none transition-all';

interface InjuryFormState {
  injuryDate: string; injuryType: string; bodyPart: string; severity: string;
  recoveryStatus: string; notes: string; treatmentPlan: string; expectedReturnDate: string;
}
const EMPTY_INJURY: InjuryFormState = {
  injuryDate: new Date().toISOString().split('T')[0], injuryType: '', bodyPart: 'Other',
  severity: 'Minor', recoveryStatus: 'Active', notes: '', treatmentPlan: '', expectedReturnDate: '',
};

// Solo athletes manage their own injuries and recovery programs: log injuries, mark
// them recovered, and open the full recovery-program modal (manual / template / AI)
// with the same manage rights a coach has — but only ever for themselves.
export function SoloRecoveryPage() {
  const { t } = useTranslation();
  const dyn = useDynamicLabels();
  const { formatDate } = useLocaleFormat();
  const { addToast: showToast } = useToast();
  const { data: playerId } = useMyPlayerId();
  const { data: injuries = [], isLoading } = useInjuries(playerId);
  const { data: activePlan } = usePlayerRecoveryPlan(playerId ?? null);
  const createInjury = useCreateInjury();
  const updateInjury = useUpdateInjury();
  const deleteInjury = useDeleteInjury();
  const recoverInjury = useRecoverInjury();

  const [form, setForm] = useState<InjuryFormState>(EMPTY_INJURY);
  const [editing, setEditing] = useState<InjuryRecord | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InjuryRecord | null>(null);
  const [recoveryInjury, setRecoveryInjury] = useState<InjuryRecord | null>(null);

  const formOpen = showNew || !!editing;

  function openNew() { setEditing(null); setForm(EMPTY_INJURY); setShowNew(true); }
  function openEdit(r: InjuryRecord) {
    setEditing(r);
    setForm({
      injuryDate: r.injuryDate.split('T')[0], injuryType: r.injuryType, bodyPart: r.bodyPart ?? 'Other',
      severity: r.severity, recoveryStatus: r.recoveryStatus, notes: r.notes ?? '',
      treatmentPlan: r.treatmentPlan ?? '', expectedReturnDate: r.expectedReturnDate ? r.expectedReturnDate.split('T')[0] : '',
    });
    setShowNew(false);
  }

  async function save() {
    if (!playerId) return;
    if (!form.injuryType.trim()) { showToast(t('injuries.typeRequired', 'Injury type is required'), 'error'); return; }
    const payload = {
      playerId,
      injuryDate: form.injuryDate,
      injuryType: form.injuryType.trim(),
      bodyPart: form.bodyPart,
      severity: form.severity as InjurySeverity,
      recoveryStatus: form.recoveryStatus as RecoveryStatus,
      notes: form.notes.trim() || null,
      treatmentPlan: form.treatmentPlan.trim() || null,
      expectedReturnDate: form.expectedReturnDate || null,
    };
    try {
      if (editing) {
        await updateInjury.mutateAsync({ id: editing.id, data: payload });
        showToast(t('injuries.injuryUpdated', 'Injury updated'), 'success');
        setEditing(null);
      } else {
        await createInjury.mutateAsync(payload as Omit<InjuryRecord, 'id'>);
        showToast(t('injuries.injuryLogged', 'Injury logged — take care of yourself'), 'success');
        setShowNew(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('injuries.saveFailed', 'Save failed'), 'error');
    }
  }

  const activeInjuries = injuries.filter(r => r.recoveryStatus !== 'FullyRecovered');

  return (
    <PageWrapper
      title={t('injuries.myRecovery', 'My Recovery')}
      actions={!formOpen ? (
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
          <Plus size={15} /> {t('injuries.logInjury', 'Log Injury')}
        </button>
      ) : undefined}
    >
      {/* Active recovery program shortcut */}
      {activePlan && (
        <button
          onClick={() => setRecoveryInjury(injuries.find(r => r.id === activePlan.injuryRecordId) ?? null)}
          className="w-full text-left rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-900/10 p-5 hover:border-rose-300 dark:hover:border-rose-800 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="inline-flex p-2.5 rounded-xl bg-rose-500/10">
                <Activity size={18} className="text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{activePlan.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('recovery.weekOf', 'Week {{current}} of {{total}}', { current: activePlan.currentWeek, total: activePlan.estimatedWeeks })} · {activePlan.injuryType}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-rose-500">
                {activePlan.totalExercises > 0 ? Math.round((activePlan.completedExercises / activePlan.totalExercises) * 100) : 0}%
              </p>
              <p className="text-[11px] text-gray-500">{t('recovery.exercisesShort', '{{done}}/{{total}} exercises', { done: activePlan.completedExercises, total: activePlan.totalExercises })}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${activePlan.totalExercises > 0 ? Math.round((activePlan.completedExercises / activePlan.totalExercises) * 100) : 0}%` }} />
          </div>
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-2">{t('recovery.openMyProgram', 'Open my recovery program →')}</p>
        </button>
      )}

      <div className="max-w-2xl space-y-4">
        {formOpen && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editing ? t('injuries.editInjury', 'Edit Injury') : t('injuries.logInjury', 'Log Injury')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('injuries.injuryDate', 'Injury Date')} type="date" value={form.injuryDate} onChange={e => setForm(v => ({ ...v, injuryDate: e.target.value }))} />
              <Input label={t('injuries.injuryTypeRequired', 'Injury Type *')} value={form.injuryType} onChange={e => setForm(v => ({ ...v, injuryType: e.target.value }))} placeholder={t('injuries.injuryTypePlaceholder', 'e.g. Ankle sprain')} />
              <Select label={t('injuries.bodyPart', 'Body Part')} value={form.bodyPart} onChange={e => setForm(v => ({ ...v, bodyPart: e.target.value }))} options={BODY_PARTS.map(s => ({ value: s, label: dyn.generic('bodyPart', s) }))} />
              <Select label={t('injuries.severity', 'Severity')} value={form.severity} onChange={e => setForm(v => ({ ...v, severity: e.target.value }))} options={INJURY_SEVERITIES.map(s => ({ value: s, label: dyn.generic('severity', s) }))} />
              <Select label={t('injuries.recoveryStatus', 'Recovery Status')} value={form.recoveryStatus} onChange={e => setForm(v => ({ ...v, recoveryStatus: e.target.value }))} options={RECOVERY_STATUSES.map(s => ({ value: s, label: s === 'FullyRecovered' ? t('injuries.fullyRecovered', 'Fully Recovered') : dyn.status(s) }))} />
              <Input label={t('injuries.expectedReturn', 'Expected Return Date')} type="date" value={form.expectedReturnDate} onChange={e => setForm(v => ({ ...v, expectedReturnDate: e.target.value }))} />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('injuries.treatmentPlan', 'Treatment Plan')}</label>
                <textarea value={form.treatmentPlan} onChange={e => setForm(v => ({ ...v, treatmentPlan: e.target.value }))} rows={2} placeholder={t('injuries.treatmentPlaceholder', 'Physio schedule, rest days, rehab protocol…')} className={TEXTAREA_CLS} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.notes', 'Notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} rows={2} placeholder={t('injuries.notesPlaceholder', 'How it happened, how it feels…')} className={TEXTAREA_CLS} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => { setEditing(null); setShowNew(false); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer">{t('common.cancel', 'Cancel')}</button>
              <button onClick={save} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer">
                {editing ? t('injuries.saveChanges', 'Save Changes') : t('injuries.logInjury', 'Log Injury')}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : injuries.length === 0 && !formOpen ? (
          <EmptyState icon={<ShieldAlert size={36} />} title={t('injuries.noInjuriesLogged', 'No injuries logged')}
            description={t('injuries.noInjuriesDesc', 'Hopefully it stays that way! If something happens, log it here to track your recovery.')}
            action={{ label: t('injuries.logInjury', 'Log Injury'), onClick: openNew }} />
        ) : (
          <>
            {activeInjuries.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-red-500">{activeInjuries.length}</span> {activeInjuries.length === 1 ? t('injuries.activeCountOne', 'active injury · {{total}} total', { total: injuries.length }) : t('injuries.activeCountMany', 'active injuries · {{total}} total', { total: injuries.length })}
              </p>
            )}
            {injuries.map(r => (
              <div key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">{r.injuryType}</span>
                      {r.bodyPart && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{dyn.generic('bodyPart', r.bodyPart)}</span>}
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', SEVERITY_STYLES[r.severity])}>{dyn.generic('severity', r.severity)}</span>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', RECOVERY_STYLES[r.recoveryStatus])}>{r.recoveryStatus === 'FullyRecovered' ? t('injuries.recovered', 'Recovered') : dyn.status(r.recoveryStatus)}</span>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Calendar size={11} /> {formatDate(r.injuryDate)}{r.expectedReturnDate ? ` → ${formatDate(r.expectedReturnDate)}` : ''}
                      {r.recoveredDate && <span className="text-green-500 ml-1">{t('injuries.recoveredOn', '· recovered {{date}}', { date: formatDate(r.recoveredDate) })}</span>}
                    </p>
                    {r.treatmentPlan && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5"><span className="font-semibold text-gray-500 dark:text-gray-400">{t('injuries.treatmentLabel', 'Treatment:')}</span> {r.treatmentPlan}</p>}
                    {r.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                    {r.recoveryStatus !== 'FullyRecovered' && (
                      <button
                        onClick={async () => { try { await recoverInjury.mutateAsync(r.id); showToast(t('injuries.markedRecovered', 'Marked recovered — welcome back!'), 'success'); } catch (err) { showToast(err instanceof Error ? err.message : t('common.failed', 'Failed'), 'error'); } }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <ShieldAlert size={11} /> {t('injuries.markRecoveredShort', 'Mark Recovered')}
                      </button>
                    )}
                    <button
                      onClick={() => setRecoveryInjury(r)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Activity size={11} /> {t('recovery.recoveryProgram', 'Recovery Program')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Full manage rights on your own program: manual / template / AI, exercises,
          milestones — plus completing exercises like any athlete. */}
      <RecoveryPlanModal
        isOpen={!!recoveryInjury}
        onClose={() => setRecoveryInjury(null)}
        injuryId={recoveryInjury?.id}
        injuryBodyPart={recoveryInjury?.bodyPart}
        isCoach={true}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try { await deleteInjury.mutateAsync(deleteTarget.id); showToast(t('injuries.injuryDeleted', 'Injury deleted'), 'success'); }
          catch (err) { showToast(err instanceof Error ? err.message : t('injuries.deleteFailed', 'Delete failed'), 'error'); }
          finally { setDeleteTarget(null); }
        }}
        title={t('injuries.deleteInjury', 'Delete Injury')}
        message={t('injuries.deleteInjuryMsg', 'Delete "{{type}}"? Any recovery plan attached to it will be removed too.', { type: deleteTarget?.injuryType })}
        confirmLabel={t('common.delete', 'Delete')}
        isLoading={deleteInjury.isPending}
      />
    </PageWrapper>
  );
}
