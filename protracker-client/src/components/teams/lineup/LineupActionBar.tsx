import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  BadgeCheck, ChevronDown, HeartPulse, Lock, Pencil, Redo2, RotateCcw, Save, Send, Trash2, Undo2, X,
} from 'lucide-react';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import { canEditLineup } from './lineupWorkflowLogic';
import type { LineupDto } from '../../../api/lineupApi';
import type { PickerMatchGroups } from './matchContextLogic';
import type { MatchResult } from '../../../types';

interface Props {
  /** '' = default, 'm:{id}' = match, 'n:{name}' = named (the <select> serialization). */
  contextValue: string;
  onSwitchContext: (value: string) => void;
  namedNames: string[];
  pickerGroups: PickerMatchGroups<MatchResult>;
  matchLabel: (matchId: number) => string;
  formationKey: string;
  saved: LineupDto | null;
  editing: boolean;
  dirty: boolean;
  canManage: boolean;
  canPublish: boolean;
  overlay: boolean;
  onToggleOverlay: () => void;
  statusPending: boolean;
  savePending: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  onRequestPublish: (publish: boolean) => void;
  onRequestResetSaved: () => void;
  onStartEdit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetToSuggested: () => void;
  onCancelEdit: () => void;
  onOpenSave: () => void;
}

// Context + action bar (sticky while editing — the workspace shell). JSX
// extracted verbatim from LineupBoard (Phase 9 §2c). The e2e workflow spec
// depends on the Save button's accessible name growing to "Save Unsaved
// changes" via the amber dot's aria-label — keep that structure.
export function LineupActionBar({
  contextValue, onSwitchContext, namedNames, pickerGroups, matchLabel, formationKey,
  saved, editing, dirty, canManage, canPublish, overlay, onToggleOverlay,
  statusPending, savePending, undoEnabled, redoEnabled,
  onRequestPublish, onRequestResetSaved, onStartEdit, onUndo, onRedo,
  onResetToSuggested, onCancelEdit, onOpenSave,
}: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-between gap-2 mb-3',
        editing && 'sticky top-0 z-20 py-2 -mx-2 px-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm',
      )}
    >
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="relative">
          <select
            value={contextValue}
            onChange={e => onSwitchContext(e.target.value)}
            className="appearance-none ps-3 pe-8 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white cursor-pointer"
            aria-label={t('teams.lineupContext', 'Lineup for')}
          >
            <option value="">{t('teams.lineupDefaultXi', 'Default XI')}</option>
            {namedNames.length > 0 && (
              <optgroup label={t('teams.lineupNamedGroup', 'Named lineups')}>
                {namedNames.map(n => (
                  <option key={n} value={`n:${n}`}>{n}</option>
                ))}
              </optgroup>
            )}
            {pickerGroups.upcoming.length > 0 && (
              <optgroup label={t('teams.lineupUpcomingGroup', 'Upcoming fixtures')}>
                {pickerGroups.upcoming.map(m => (
                  <option key={m.id} value={`m:${m.id}`}>{matchLabel(m.id)}</option>
                ))}
              </optgroup>
            )}
            {pickerGroups.recent.length > 0 && (
              <optgroup label={t('teams.lineupRecentGroup', 'Recent results')}>
                {pickerGroups.recent.map(m => (
                  <option key={m.id} value={`m:${m.id}`}>{matchLabel(m.id)}</option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown size={13} className="absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
        <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
          {formationKey}
        </span>
        {saved ? (
          <>
            {saved.status === 'Published' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                <BadgeCheck size={12} aria-hidden />
                {t('teams.lineupStatusPublished', 'Published')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 dark:text-gray-400 text-[11px] font-bold">
                {t('teams.lineupStatusDraft', 'Draft')}
              </span>
            )}
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {saved.updatedByName
                ? t('teams.lineupSavedMetaBy', 'Saved · {{date}} · {{name}}', { date: formatDate(saved.updatedAt, { month: 'short', day: 'numeric' }), name: saved.updatedByName })
                : t('teams.lineupSavedMeta', 'Saved · {{date}}', { date: formatDate(saved.updatedAt, { month: 'short', day: 'numeric' }) })}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('teams.lineupSuggestedMeta', 'Suggested — auto-arranged by rating, not saved')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!editing && (
          <button
            type="button"
            onClick={onToggleOverlay}
            aria-pressed={overlay}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
              overlay
                ? 'bg-rose-500/10 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            <HeartPulse size={13} /> {t('teams.lineupSquadHealth', 'Squad health')}
          </button>
        )}
        {canManage && !editing && (
          <>
            {saved && canPublish && (
              saved.status === 'Published' ? (
                <button
                  type="button"
                  onClick={() => onRequestPublish(false)}
                  disabled={statusPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Undo2 size={13} /> {t('teams.lineupUnpublish', 'Unpublish')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequestPublish(true)}
                  disabled={statusPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send size={13} /> {t('teams.lineupPublish', 'Publish')}
                </button>
              )
            )}
            {saved && canEditLineup(saved.status) && (
              <button
                type="button"
                onClick={onRequestResetSaved}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <Trash2 size={13} /> {t('teams.lineupResetSaved', 'Remove saved')}
              </button>
            )}
            {canEditLineup(saved?.status) ? (
              <button
                type="button"
                onClick={onStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={13} /> {t('teams.lineupEdit', 'Edit lineup')}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <Lock size={13} aria-hidden />
                {t('teams.lineupLockedHint', 'Published — unpublish to edit')}
              </span>
            )}
          </>
        )}
        {editing && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!undoEnabled}
              title={`${t('teams.lineupUndo', 'Undo')} (Ctrl+Z)`}
              aria-label={t('teams.lineupUndo', 'Undo')}
              className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!redoEnabled}
              title={`${t('teams.lineupRedo', 'Redo')} (Ctrl+Shift+Z)`}
              aria-label={t('teams.lineupRedo', 'Redo')}
              className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Redo2 size={13} />
            </button>
            <button
              type="button"
              onClick={onResetToSuggested}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} /> {t('teams.lineupResetSuggested', 'Reset to suggested XI')}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <X size={13} /> {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={onOpenSave}
              disabled={savePending}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Save size={13} /> {t('common.save', 'Save')}
              {dirty && <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-gray-900" aria-label={t('teams.lineupUnsaved', 'Unsaved changes')} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
