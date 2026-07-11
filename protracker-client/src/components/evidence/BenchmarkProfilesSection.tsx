import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal, ConfirmModal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  useBenchmarkProfiles, useCreateBenchmarkProfile, useUpdateBenchmarkProfile, useDeleteBenchmarkProfile,
} from '../../hooks/useBenchmarks';
import type { BenchmarkValueInput } from '../../api/benchmarksApi';
import type { BenchmarkProfile } from '../../types';

const LEVELS = ['Recreational', 'Amateur', 'SemiPro', 'Professional'] as const;

// Coach settings: system benchmark profiles (read-only) + create/edit custom ones.
export function BenchmarkProfilesSection({ sportId }: { sportId: number | null | undefined }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { data: profiles = [] } = useBenchmarkProfiles(sportId);
  const deleteProfile = useDeleteBenchmarkProfile();

  const [editing, setEditing] = useState<BenchmarkProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkProfile | null>(null);

  if (!sportId) return null;

  return (
    <Card header={
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Scale size={15} className="text-indigo-500" />
          {t('evidence.myBenchmarks', 'My Benchmarks')}
        </span>
        <Button type="button" size="sm" onClick={() => setCreating(true)}>
          <Plus size={13} /> {t('evidence.createProfile', 'Create Custom Profile')}
        </Button>
      </div>
    }>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {t('evidence.myBenchmarksDesc',
          'Benchmark profiles calibrate evidence scores for an age group or competition level. Assign a profile to each team from its Evidence tab.')}
      </p>
      <div className="space-y-1.5">
        {profiles.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
              <p className="text-[11px] text-gray-400">
                {p.ageGroupMin != null || p.ageGroupMax != null
                  ? `${p.ageGroupMin ?? ''}–${p.ageGroupMax ?? '+'} · `
                  : ''}
                {p.competitionLevel} · {t('evidence.metricsCount', '{{count}} metrics', { count: p.values.length })}
              </p>
            </div>
            {p.isMine ? (
              <>
                <button type="button" onClick={() => setEditing(p)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 cursor-pointer"
                  aria-label={t('common.edit', 'Edit')}>
                  <Pencil size={13} />
                </button>
                <button type="button" onClick={() => setDeleteTarget(p)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 cursor-pointer"
                  aria-label={t('common.delete', 'Delete')}>
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <Lock size={10} /> {t('evidence.systemProfile', 'System')}
              </span>
            )}
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <BenchmarkProfileModal
          isOpen
          onClose={() => { setCreating(false); setEditing(null); }}
          sportId={sportId}
          profiles={profiles}
          editing={editing}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteProfile.mutateAsync(deleteTarget.id);
            addToast(t('evidence.profileDeleted', 'Profile deleted'), 'success');
          } catch (err) {
            addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
          } finally {
            setDeleteTarget(null);
          }
        }}
        title={t('evidence.deleteProfileTitle', 'Delete Benchmark Profile')}
        message={t('evidence.deleteProfileMsg', 'Delete "{{name}}"? Teams using it fall back to sport defaults.', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete', 'Delete')}
        isLoading={deleteProfile.isPending}
      />
    </Card>
  );
}

// Create/edit modal: meta fields + a per-metric anchor grid, seeded from a base profile.
function BenchmarkProfileModal({ isOpen, onClose, sportId, profiles, editing }: {
  isOpen: boolean; onClose: () => void; sportId: number;
  profiles: BenchmarkProfile[]; editing: BenchmarkProfile | null;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const create = useCreateBenchmarkProfile();
  const update = useUpdateBenchmarkProfile();

  const [name, setName] = useState(editing?.name ?? '');
  const [ageMin, setAgeMin] = useState(editing?.ageGroupMin != null ? String(editing.ageGroupMin) : '');
  const [ageMax, setAgeMax] = useState(editing?.ageGroupMax != null ? String(editing.ageGroupMax) : '');
  const [level, setLevel] = useState<string>(editing?.competitionLevel ?? 'Amateur');
  const [baseId, setBaseId] = useState(editing ? '' : String(profiles.find(p => p.isDefault)?.id ?? ''));
  const [values, setValues] = useState<Record<number, { low: string; mid: string; high: string }>>({});

  const base = editing ?? profiles.find(p => String(p.id) === baseId) ?? null;

  // (Re)seed the editable grid from the base/editing profile's anchors.
  useEffect(() => {
    if (!base) { setValues({}); return; }
    const next: Record<number, { low: string; mid: string; high: string }> = {};
    for (const v of base.values) {
      next[v.metricDefinitionId] = {
        low: String(v.benchmarkLow), mid: String(v.benchmarkMid), high: String(v.benchmarkHigh),
      };
    }
    setValues(next);
  }, [base]);

  const rows = useMemo(() => base?.values ?? [], [base]);
  const isPending = create.isPending || update.isPending;

  async function save() {
    if (!name.trim()) {
      addToast(t('evidence.profileNameRequired', 'Profile name is required'), 'error');
      return;
    }
    const parsed: BenchmarkValueInput[] = [];
    for (const row of rows) {
      const v = values[row.metricDefinitionId];
      if (!v) continue;
      const low = Number(v.low), mid = Number(v.mid), high = Number(v.high);
      if ([low, mid, high].some(Number.isNaN)) {
        addToast(t('evidence.invalidBenchmark', 'Invalid benchmark for {{metric}}', { metric: row.metricName }), 'error');
        return;
      }
      parsed.push({ metricDefinitionId: row.metricDefinitionId, benchmarkLow: low, benchmarkMid: mid, benchmarkHigh: high });
    }

    const payload = {
      sportId,
      name: name.trim(),
      ageGroupMin: ageMin ? Number(ageMin) : null,
      ageGroupMax: ageMax ? Number(ageMax) : null,
      competitionLevel: level,
      values: parsed,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: payload });
      else await create.mutateAsync(payload);
      addToast(t('evidence.profileSaved', 'Benchmark profile saved'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg"
      title={editing
        ? t('evidence.editProfileTitle', 'Edit Benchmark Profile')
        : t('evidence.createProfileTitle', 'Create Benchmark Profile')}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('evidence.profileName', 'Profile name')} value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('evidence.profileNamePlaceholder', 'e.g. U14 Competitive')} />
          <Select label={t('evidence.competitionLevel', 'Competition level')} value={level}
            onChange={e => setLevel(e.target.value)}
            options={LEVELS.map(l => ({ value: l, label: l }))} />
          <Input label={t('evidence.ageMin', 'Age from (optional)')} type="number" min={5} max={60}
            value={ageMin} onChange={e => setAgeMin(e.target.value)} />
          <Input label={t('evidence.ageMax', 'Age to (optional)')} type="number" min={5} max={60}
            value={ageMax} onChange={e => setAgeMax(e.target.value)} />
        </div>

        {!editing && (
          <Select
            label={t('evidence.basedOn', 'Based on')}
            value={baseId}
            onChange={e => setBaseId(e.target.value)}
            options={profiles.map(p => ({ value: String(p.id), label: p.name }))}
          />
        )}

        {rows.length > 0 && (
          <div>
            <div className="grid grid-cols-[1fr_repeat(3,4.5rem)] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 pe-1">
              <span>{t('evidence.metric', 'Metric')}</span>
              <span>{t('evidence.colLow', 'Low')}</span>
              <span>{t('evidence.colMid', 'Mid')}</span>
              <span>{t('evidence.colHigh', 'Elite')}</span>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pe-1">
              {rows.map(row => {
                const v = values[row.metricDefinitionId] ?? { low: '', mid: '', high: '' };
                const set = (k: 'low' | 'mid' | 'high', val: string) =>
                  setValues(prev => ({ ...prev, [row.metricDefinitionId]: { ...v, [k]: val } }));
                return (
                  <div key={row.metricDefinitionId} className="grid grid-cols-[1fr_repeat(3,4.5rem)] gap-2 items-center">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {row.metricName}
                      {row.unit && <span className="text-gray-400"> ({row.unit})</span>}
                    </span>
                    {(['low', 'mid', 'high'] as const).map(k => (
                      <input key={k} type="number" step="any" value={v[k]}
                        onChange={e => set(k, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="button" onClick={save} isLoading={isPending}>{t('common.save', 'Save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
