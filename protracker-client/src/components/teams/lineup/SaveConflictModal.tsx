import { useTranslation } from 'react-i18next';
import { AlertTriangle, Lock, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import type { ConflictInfo } from './lineupWorkflowLogic';

export type ConflictIntent =
  /** A save 409'd — the row moved (or vanished, or is published) under us. */
  | 'conflict'
  /** Pre-save check: the chosen target ALREADY has a saved lineup (informed overwrite). */
  | 'crossTarget';

interface Props {
  isOpen: boolean;
  intent: ConflictIntent;
  info: ConflictInfo;
  saving: boolean;
  /** Re-save with the server's current version — an explicit, informed clobber. */
  onOverwrite: () => void;
  /** Adopt the server state and leave edit mode (draft discarded explicitly). */
  onReload: () => void;
  /** 'deleted' only: re-create with baseVersion null. */
  onSaveAsNew: () => void;
  /** Keep editing (no action taken). */
  onClose: () => void;
}

// Phase 6 conflict UX — the "never a silent clobber" dialog. A version conflict
// ALWAYS shows who edited and when (approval-pinned) so Overwrite is an
// informed act; a published row is locked (the server already refused); a
// deleted row offers an honest re-create. All buttons are type="button" via
// the shared Button default-override below (Modal content is not a form here,
// but the convention stands).
export function SaveConflictModal({ isOpen, intent, info, saving, onOverwrite, onReload, onSaveAsNew, onClose }: Props) {
  const { t } = useTranslation();
  const { formatDateTime } = useLocaleFormat();

  const when = info.editedAt ? formatDateTime(info.editedAt) : null;
  // Who + when, stated only from real data — no editor recorded → date-only line.
  const editedLine =
    info.editedByName && when
      ? t('teams.lineupConflictWho', 'Last saved by {{name}} · {{date}}', { name: info.editedByName, date: when })
      : when
        ? t('teams.lineupConflictWhen', 'Last saved {{date}}', { date: when })
        : null;

  const title =
    info.kind === 'published' ? t('teams.lineupLockedTitle', 'Lineup is published')
    : info.kind === 'deleted' ? t('teams.lineupDeletedTitle', 'Lineup removed elsewhere')
    : intent === 'crossTarget' ? t('teams.lineupOverwriteTitle', 'Overwrite saved lineup?')
    : t('teams.lineupConflictTitle', 'Edited elsewhere');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {info.kind === 'published'
            ? <Lock size={20} className="text-amber-500 mt-0.5 shrink-0" aria-hidden />
            : info.kind === 'deleted'
              ? <Trash2 size={20} className="text-rose-500 mt-0.5 shrink-0" aria-hidden />
              : <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" aria-hidden />}
          <div className="space-y-1.5">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {info.kind === 'published'
                ? t('teams.lineupLockedBody', 'This lineup is published — unpublish it to make changes.')
                : info.kind === 'deleted'
                  ? t('teams.lineupDeletedBody', 'This lineup no longer exists — it was removed while you were editing.')
                  : intent === 'crossTarget'
                    ? t('teams.lineupOverwriteBody', 'A lineup is already saved here. Saving will replace it.')
                    : t('teams.lineupConflictBody', 'This lineup was changed while you were editing. Reload the latest version, or overwrite it with yours.')}
            </p>
            {editedLine && (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {editedLine}
                {info.currentVersion != null && info.kind !== 'published' && (
                  <span className="text-gray-400 dark:text-gray-500"> · v{info.currentVersion}</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {info.kind === 'published'
              ? t('common.close', 'Close')
              : t('teams.lineupKeepEditing', 'Keep editing')}
          </Button>
          {info.kind === 'version' && intent === 'conflict' && (
            <Button type="button" variant="secondary" onClick={onReload} disabled={saving}>
              <RefreshCw size={16} aria-hidden />
              {t('teams.lineupReload', 'Reload latest')}
            </Button>
          )}
          {info.kind === 'version' && (
            <Button type="button" variant="danger" onClick={onOverwrite} disabled={saving}>
              <Save size={16} aria-hidden />
              {t('teams.lineupOverwrite', 'Overwrite')}
            </Button>
          )}
          {info.kind === 'deleted' && (
            <Button type="button" onClick={onSaveAsNew} disabled={saving}>
              <Save size={16} aria-hidden />
              {t('teams.lineupSaveAsNew', 'Save as new')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
