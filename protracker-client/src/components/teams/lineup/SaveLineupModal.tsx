import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Save, Shield, CalendarDays } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import type { MatchResult } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  matches: MatchResult[];
  /** Pre-selected save target (from the current context). */
  initialMatchId: number | null;
  saving: boolean;
  onSave: (matchId: number | null) => void;
}

// The save-time choice (decided in the Phase 2 spec): the coach picks "team
// default XI" or "for a specific match". Matches are labeled with their DATE —
// this attaches a lineup to a logged match, it is not fixture planning.
export function SaveLineupModal({ isOpen, onClose, matches, initialMatchId, saving, onSave }: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const [forMatch, setForMatch] = useState(initialMatchId != null);
  const [matchId, setMatchId] = useState<number | null>(initialMatchId);

  const matchLabel = (m: MatchResult) =>
    `${t('teams.lineupVs', 'vs')} ${m.opponentName} · ${formatDate(m.matchDate, { year: 'numeric', month: 'short', day: 'numeric' })}`;

  const canSave = !saving && (!forMatch || matchId != null);

  const choiceClass = (active: boolean) => clsx(
    'w-full flex items-start gap-3 p-3 rounded-xl border text-start transition-colors cursor-pointer',
    active
      ? 'border-indigo-500 bg-indigo-500/10'
      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('teams.lineupSaveTitle', 'Save lineup')} size="sm">
      <div className="space-y-2" role="radiogroup" aria-label={t('teams.lineupSaveTitle', 'Save lineup')}>
        <button type="button" role="radio" aria-checked={!forMatch} onClick={() => setForMatch(false)} className={choiceClass(!forMatch)}>
          <Shield size={18} className={!forMatch ? 'text-indigo-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <span>
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {t('teams.lineupSaveDefault', 'Team default XI')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('teams.lineupSaveDefaultDesc', 'Your standing lineup — shown whenever no match is selected.')}
            </span>
          </span>
        </button>

        <button type="button" role="radio" aria-checked={forMatch} onClick={() => setForMatch(true)} className={choiceClass(forMatch)}>
          <CalendarDays size={18} className={forMatch ? 'text-indigo-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
              {t('teams.lineupSaveForMatch', 'For a specific match')}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {t('teams.lineupSaveForMatchDesc', 'The lineup used for one logged match.')}
            </span>
          </span>
        </button>

        {forMatch && (
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
          onClick={() => onSave(forMatch ? matchId : null)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          <Save size={14} /> {saving ? t('teams.lineupSaving', 'Saving…') : t('common.save', 'Save')}
        </button>
      </div>
    </Modal>
  );
}
