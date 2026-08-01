import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Save, Shield, CalendarDays, Bookmark } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import type { MatchResult } from '../../../types';
import { MAX_NAMED_LINEUPS, normalizeLineupName, type LineupContext } from './lineupWorkflowLogic';

type TargetKind = 'default' | 'named' | 'match';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  matches: MatchResult[];
  /** Existing NAMED team lineup names (for re-save pick + the cap). */
  namedNames: string[];
  /** Pre-selected save target (from the current context). */
  initialContext: LineupContext;
  saving: boolean;
  onSave: (ctx: LineupContext) => void;
}

// The save-time choice, Phase 6 shape: team default XI, a NAMED team lineup
// (two-key model, cap 10 — server-enforced, mirrored here), or a logged match
// (date-labeled — attaching to a match, not fixture planning).
export function SaveLineupModal({ isOpen, onClose, matches, namedNames, initialContext, saving, onSave }: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const [kind, setKind] = useState<TargetKind>(initialContext.kind);
  const [matchId, setMatchId] = useState<number | null>(initialContext.kind === 'match' ? initialContext.matchId : null);
  const [name, setName] = useState(initialContext.kind === 'named' ? initialContext.name : '');

  const matchLabel = (m: MatchResult) =>
    `${t('teams.lineupVs', 'vs')} ${m.opponentName} · ${formatDate(m.matchDate, { year: 'numeric', month: 'short', day: 'numeric' })}`;

  const trimmed = name.trim();
  const isExistingName = namedNames.some(n => normalizeLineupName(n) === normalizeLineupName(trimmed));
  const capReached = namedNames.length >= MAX_NAMED_LINEUPS;
  // A NEW name at the cap can't save (the server would 400); re-saving an
  // existing named lineup is always allowed.
  const namedBlocked = kind === 'named' && ((trimmed.length === 0 || trimmed.length > 60) || (capReached && !isExistingName));
  const canSave = !saving && !namedBlocked && (kind !== 'match' || matchId != null);

  const submit = () => {
    if (kind === 'default') onSave({ kind: 'default' });
    else if (kind === 'named') onSave({ kind: 'named', name: trimmed });
    else if (matchId != null) onSave({ kind: 'match', matchId });
  };

  const choiceClass = (active: boolean) => clsx(
    'w-full flex items-start gap-3 p-3 rounded-xl border text-start transition-colors cursor-pointer',
    active
      ? 'border-indigo-500 bg-indigo-500/10'
      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
  );

  const iconClass = (active: boolean) => (active ? 'text-indigo-500 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('teams.lineupSaveTitle', 'Save lineup')} size="sm">
      <div className="space-y-2" role="radiogroup" aria-label={t('teams.lineupSaveTitle', 'Save lineup')}>
        <button type="button" role="radio" aria-checked={kind === 'default'} onClick={() => setKind('default')} className={choiceClass(kind === 'default')}>
          <Shield size={18} className={iconClass(kind === 'default')} />
          <span>
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {t('teams.lineupSaveDefault', 'Team default XI')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('teams.lineupSaveDefaultDesc', 'Your standing lineup — shown whenever no match is selected.')}
            </span>
          </span>
        </button>

        <button type="button" role="radio" aria-checked={kind === 'named'} onClick={() => setKind('named')} className={choiceClass(kind === 'named')}>
          <Bookmark size={18} className={iconClass(kind === 'named')} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {t('teams.lineupSaveNamed', 'Named lineup')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('teams.lineupSaveNamedDesc', 'A reusable team lineup, e.g. "First Team" or "Rotation".')}
              {' '}
              {t('teams.lineupNamedCap', '{{used}} of {{max}} used', { used: namedNames.length, max: MAX_NAMED_LINEUPS })}
            </span>
          </span>
        </button>

        {kind === 'named' && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={name}
              maxLength={60}
              onChange={e => setName(e.target.value)}
              list="pt-named-lineups"
              placeholder={t('teams.lineupNamePlaceholder', 'Lineup name')}
              aria-label={t('teams.lineupNamePlaceholder', 'Lineup name')}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            <datalist id="pt-named-lineups">
              {namedNames.map(n => <option key={n} value={n} />)}
            </datalist>
            {capReached && !isExistingName && trimmed.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('teams.lineupNamedCapHit', 'Name limit reached — pick an existing named lineup or remove one first.')}
              </p>
            )}
          </div>
        )}

        <button type="button" role="radio" aria-checked={kind === 'match'} onClick={() => setKind('match')} className={choiceClass(kind === 'match')}>
          <CalendarDays size={18} className={iconClass(kind === 'match')} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {t('teams.lineupSaveForMatch', 'For a specific match')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('teams.lineupSaveForMatchDesc', 'The lineup used for one logged match.')}
            </span>
          </span>
        </button>

        {kind === 'match' && (
          <select
            value={matchId ?? ''}
            onChange={e => setMatchId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            aria-label={t('teams.lineupPickMatch', 'Pick a match')}
          >
            <option value="">{t('teams.lineupPickMatch', 'Pick a match')}</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>{matchLabel(m)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={submit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          <Save size={14} /> {saving ? t('teams.lineupSaving', 'Saving…') : t('common.save', 'Save')}
        </button>
      </div>
    </Modal>
  );
}
