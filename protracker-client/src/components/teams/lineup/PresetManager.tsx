import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Bookmark, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { Modal, ConfirmModal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useToast } from '../../../context/ToastContext';
import { useTacticalPresets, useTacticalPresetMutations } from '../../../hooks/useLineup';
import type { TacticalPresetDto } from '../../../api/lineupApi';
import type { FormationDef } from './lineupFormations';
import {
  applyPresetToDraft, computePresetDiff,
  type DraftLike, type PresetApplyResult, type PresetDiffEntry,
} from './lineupWorkflowLogic';
import { roleLabel, tacticalLabelText } from './tacticalCatalog';

interface Props {
  sportId: number;
  draft: DraftLike;
  formations: readonly FormationDef[];
  nameOf: (id?: number | null) => string;
  /** Commit the applied preset as ONE reducer step (one undo). */
  onApply: (result: PresetApplyResult, presetName: string) => void;
}

const MAX_PRESETS = 20;

// Tactical presets (Phase 6): coach-owned bundles of formation + slot roles +
// labels — NOTHING player-bound. Apply is never blind: the diff (derived from
// the apply result itself) is shown first, with every consequence visible —
// including a captaincy cleared by a formation shrink. Empty diff = Apply
// disabled ("nothing would change").
export function PresetManager({ sportId, draft, formations, nameOf, onApply }: Props) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const presets = useTacticalPresets(sportId, open);
  const { create, update, remove } = useTacticalPresetMutations(sportId);

  const [diffFor, setDiffFor] = useState<TacticalPresetDto | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [renaming, setRenaming] = useState<TacticalPresetDto | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [deleting, setDeleting] = useState<TacticalPresetDto | null>(null);

  const list = presets.data ?? [];
  const capReached = list.length >= MAX_PRESETS;

  const diff: PresetDiffEntry[] = useMemo(
    () => (diffFor
      ? computePresetDiff(draft, { formation: diffFor.formation, roles: diffFor.roles, labels: diffFor.labels }, formations)
      : []),
    [diffFor, draft, formations],
  );

  const describeEntry = (e: PresetDiffEntry): string => {
    switch (e.kind) {
      case 'formation':
        return e.benched.length > 0
          ? t('teams.presetDiffFormationBench', 'Formation {{from}} → {{to}} — benches {{names}}',
              { from: e.from, to: e.to, names: e.benched.map(id => nameOf(id)).join(', ') })
          : t('teams.presetDiffFormation', 'Formation {{from}} → {{to}}', { from: e.from, to: e.to });
      case 'roleSet':
        return t('teams.presetDiffRoleSet', '{{slot}}: role set to {{role}}', { slot: e.slotKey, role: roleLabel(t, e.role) });
      case 'roleChanged':
        return t('teams.presetDiffRoleChanged', '{{slot}}: {{from}} → {{to}}',
          { slot: e.slotKey, from: roleLabel(t, e.from), to: roleLabel(t, e.to) });
      case 'roleCleared':
        return t('teams.presetDiffRoleCleared', '{{slot}}: role cleared (was {{from}})', { slot: e.slotKey, from: roleLabel(t, e.from) });
      case 'labelAdded':
        return t('teams.presetDiffLabelAdded', 'Label added: {{label}}', { label: tacticalLabelText(t, e.label) });
      case 'labelRemoved':
        return t('teams.presetDiffLabelRemoved', 'Label removed: {{label}}', { label: tacticalLabelText(t, e.label) });
      case 'captainCleared':
        return t('teams.presetDiffCaptainCleared', 'Captain cleared — {{name}} is benched by the formation change', { name: nameOf(e.playerId) });
      case 'viceCaptainCleared':
        return t('teams.presetDiffViceCleared', 'Vice-captain cleared — {{name}} is benched by the formation change', { name: nameOf(e.playerId) });
      case 'setPieceCleared':
        return t('teams.presetDiffSetPieceCleared', 'Set-piece taker cleared ({{type}}) — {{name}} is benched', { type: e.type, name: nameOf(e.playerId) });
    }
  };

  const applyNow = () => {
    if (!diffFor || diff.length === 0) return;
    const result = applyPresetToDraft(
      draft,
      { formation: diffFor.formation, roles: diffFor.roles, labels: diffFor.labels },
      formations,
    );
    onApply(result, diffFor.name);
    setDiffFor(null);
  };

  const saveCurrent = () => {
    const name = saveAsName.trim();
    if (name.length === 0) return;
    create.mutate(
      {
        sportId,
        name,
        formation: draft.formationKey,
        // Formation + roles + labels ONLY — never players/captain/set-pieces.
        roles: { ...draft.tactical.roles },
        labels: [...draft.tactical.labels],
      },
      {
        onSuccess: () => {
          setSaveAsOpen(false);
          setSaveAsName('');
          addToast(t('teams.presetSaved', 'Preset saved'), 'success');
        },
        onError: err => addToast(err instanceof Error ? err.message : t('teams.presetFailed', 'Could not save the preset'), 'error'),
      },
    );
  };

  const renameNow = () => {
    if (!renaming) return;
    const name = renameTo.trim();
    if (name.length === 0) return;
    update.mutate(
      {
        id: renaming.id,
        data: { sportId, name, formation: renaming.formation, roles: renaming.roles, labels: renaming.labels },
      },
      {
        onSuccess: () => setRenaming(null),
        onError: err => addToast(err instanceof Error ? err.message : t('teams.presetFailed', 'Could not save the preset'), 'error'),
      },
    );
  };

  return (
    <section
      aria-label={t('teams.presetsTitle', 'Tactical presets')}
      className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Bookmark size={15} className="text-gray-400" />
          {t('teams.presetsTitle', 'Tactical presets')}
        </span>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('teams.presetsHint', 'Formation, slot roles and labels only — players, captaincy and set pieces are never part of a preset.')}
          </p>
          {presets.isLoading ? (
            <p className="text-sm text-gray-400">{t('common.loading', 'Loading…')}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('teams.presetsEmpty', 'No presets yet for this sport.')}</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map(p => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {[p.formation, t('teams.presetMeta', '{{roles}} roles · {{labels}} labels', { roles: Object.keys(p.roles).length, labels: p.labels.length })]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRenaming(p); setRenameTo(p.name); }}
                    aria-label={t('teams.presetRename', 'Rename preset')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    aria-label={t('teams.presetDelete', 'Delete preset')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDiffFor(p)}>
                    {t('teams.presetApply', 'Apply…')} <ArrowRight size={13} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={capReached}
            onClick={() => setSaveAsOpen(true)}
            title={capReached ? t('teams.presetsCapHit', 'Preset limit reached ({{max}})', { max: MAX_PRESETS }) : undefined}
          >
            {t('teams.presetSaveCurrent', 'Save current as preset')}
          </Button>
          {capReached && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('teams.presetsCapHit', 'Preset limit reached ({{max}})', { max: MAX_PRESETS })}
            </p>
          )}
        </div>
      )}

      {/* Apply diff — never blind. Empty diff = nothing to apply. */}
      <Modal
        isOpen={diffFor != null}
        onClose={() => setDiffFor(null)}
        title={diffFor ? t('teams.presetApplyTitle', 'Apply "{{name}}"?', { name: diffFor.name }) : ''}
        size="sm"
      >
        {diff.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('teams.presetNoChanges', 'Nothing would change — the draft already matches this preset.')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {diff.map((e, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span aria-hidden className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                {describeEntry(e)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setDiffFor(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="button" disabled={diff.length === 0} onClick={applyNow}>
            {t('teams.presetApplyConfirm', 'Apply changes')}
          </Button>
        </div>
      </Modal>

      {/* Save current as preset */}
      <Modal isOpen={saveAsOpen} onClose={() => setSaveAsOpen(false)} title={t('teams.presetSaveCurrent', 'Save current as preset')} size="sm">
        <input
          type="text"
          value={saveAsName}
          maxLength={60}
          onChange={e => setSaveAsName(e.target.value)}
          placeholder={t('teams.presetNamePlaceholder', 'Preset name')}
          aria-label={t('teams.presetNamePlaceholder', 'Preset name')}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setSaveAsOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="button" disabled={saveAsName.trim().length === 0 || create.isPending} onClick={saveCurrent}>
            {t('common.save', 'Save')}
          </Button>
        </div>
      </Modal>

      {/* Rename */}
      <Modal isOpen={renaming != null} onClose={() => setRenaming(null)} title={t('teams.presetRename', 'Rename preset')} size="sm">
        <input
          type="text"
          value={renameTo}
          maxLength={60}
          onChange={e => setRenameTo(e.target.value)}
          aria-label={t('teams.presetNamePlaceholder', 'Preset name')}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="button" disabled={renameTo.trim().length === 0 || update.isPending} onClick={renameNow}>
            {t('common.save', 'Save')}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSettled: () => setDeleting(null) });
        }}
        title={t('teams.presetDeleteTitle', 'Delete preset?')}
        message={t('teams.presetDeleteBody', 'This removes the preset for every team — saved lineups are not affected.')}
      />
    </section>
  );
}
