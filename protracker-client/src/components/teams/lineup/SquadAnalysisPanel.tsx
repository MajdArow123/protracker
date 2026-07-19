import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { positionAbbr } from './lineupLayouts';
import { WARNING_EN, type SquadWarning } from './lineupAnalysisLogic';

// Squad analysis (Phase 5): the buildWarnings output as a collapsible panel —
// available in BOTH view and edit mode. Severity is icon + text, never color
// alone; info rows are visually subordinate (smaller, muted) and always sort
// after warnings (buildWarnings' deterministic order — the panel renders the
// list as given and never re-sorts). Zero warnings renders an explicit
// "no gaps" line: an empty panel would be an ambiguous claim.

interface Props {
  warnings: SquadWarning[];
  nameOf: (id?: number | null) => string;
  editing: boolean;
  /** Edit mode: focus a slot (select it) — the action for slot-anchored rows. */
  onSelectSlot?: (slotKey: string) => void;
  /** View mode: open the player's inspector — the action for player rows. */
  onOpenPlayer?: (playerId: number) => void;
  /** Edit mode: bring the tactics panel into view (captainNotSet action). */
  onOpenTactics?: () => void;
}

export function SquadAnalysisPanel({ warnings, nameOf, editing, onSelectSlot, onOpenPlayer, onOpenTactics }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const warnCount = warnings.filter(w => w.severity === 'warning').length;
  const infoCount = warnings.length - warnCount;

  // Own live region (a11y): count CHANGES are announced without stomping the
  // board's move announcements. Mount is silent.
  const [liveMsg, setLiveMsg] = useState('');
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (prevCount.current != null && prevCount.current !== warnCount) {
      setLiveMsg(t('teams.squadWarnAnnounce', 'Squad analysis: {{count}} warnings', { count: warnCount }));
    }
    prevCount.current = warnCount;
  }, [warnCount, t]);

  const positionsLabel = (ids: readonly number[]) => ids.map(id => positionAbbr(id, t)).join(', ');

  const message = (w: SquadWarning): string => {
    switch (w.code) {
      case 'emptySlots':
        return t('teams.squadWarnEmptySlots', WARNING_EN.emptySlots, { slots: w.slotKeys.join(', ') });
      case 'injuredStarters':
        return t('teams.squadWarnInjured', WARNING_EN.injuredStarters, { names: w.playerIds.map(id => nameOf(id)).join(', ') });
      case 'oopStarters':
        return t('teams.squadWarnOop', WARNING_EN.oopStarters, { names: w.playerIds.map(id => nameOf(id)).join(', ') });
      case 'lowEvidenceStarters':
        return t('teams.squadWarnLowEvidence', WARNING_EN.lowEvidenceStarters, { names: w.playerIds.map(id => nameOf(id)).join(', ') });
      case 'noBackupKeeper':
        return t('teams.squadWarnNoBackupKeeper', WARNING_EN.noBackupKeeper);
      case 'noBenchCover':
        return t('teams.squadWarnNoBenchCover', WARNING_EN.noBenchCover, { positions: positionsLabel(w.positionIds ?? []) });
      case 'footMismatch':
        return t('teams.squadWarnFootMismatch', WARNING_EN.footMismatch, {
          name: nameOf(w.playerIds[0]),
          side: w.side === 'left' ? t('teams.squadSideLeft', 'left') : t('teams.squadSideRight', 'right'),
          foot: t(`teams.foot${w.foot}`, w.foot ?? ''),
        });
      case 'captainNotSet':
        return t('teams.squadWarnCaptainNotSet', WARNING_EN.captainNotSet);
    }
  };

  // The action is a REAL focusable control per row (a11y requirement):
  // slot-anchored rows select the slot in edit mode; player rows open the
  // inspector in view mode; the captain nudge scrolls to the tactics panel.
  const action = (w: SquadWarning) => {
    if (w.code === 'captainNotSet') {
      return onOpenTactics && (
        <button type="button" onClick={onOpenTactics} className="font-semibold underline cursor-pointer flex-shrink-0">
          {t('teams.squadSetCaptain', 'Set captain')}
        </button>
      );
    }
    if (editing && onSelectSlot && w.slotKeys.length > 0) {
      return (
        <button
          type="button"
          onClick={() => onSelectSlot(w.slotKeys[0])}
          aria-label={t('teams.squadGoToSlot', 'Select slot {{slot}}', { slot: w.slotKeys[0] })}
          className="font-semibold underline cursor-pointer flex-shrink-0"
        >
          {t('teams.squadViewSlot', 'View slot')}
        </button>
      );
    }
    if (!editing && onOpenPlayer && w.playerIds.length === 1) {
      return (
        <button
          type="button"
          onClick={() => onOpenPlayer(w.playerIds[0])}
          className="font-semibold underline cursor-pointer flex-shrink-0"
        >
          {t('teams.squadOpenPlayer', 'Open player')}
        </button>
      );
    }
    return null;
  };

  return (
    <section
      aria-label={t('teams.squadAnalysis', 'Squad analysis')}
      className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <div aria-live="polite" role="status" className="sr-only">{liveMsg}</div>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
          {t('teams.squadAnalysis', 'Squad analysis')}
          {warnCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
              {t('teams.squadWarnCount', '{{count}} warnings', { count: warnCount })}
            </span>
          )}
          {infoCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-500 dark:text-gray-400 text-[10px] font-semibold">
              {t('teams.squadNoteCount', '{{count}} notes', { count: infoCount })}
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? t('teams.squadCollapse', 'Collapse squad analysis') : t('teams.squadExpand', 'Expand squad analysis')}
          className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        warnings.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" aria-hidden="true" />
            {t('teams.squadNoGaps', 'No gaps detected in this arrangement.')}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {warnings.map((w, i) => (
              <li
                key={`${w.code}-${w.slotKeys[0] ?? i}`}
                className={clsx(
                  'flex items-baseline gap-2',
                  w.severity === 'warning'
                    ? 'text-xs text-gray-700 dark:text-gray-200'
                    : 'text-[11px] text-gray-500 dark:text-gray-400',
                )}
              >
                {w.severity === 'warning' ? (
                  <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 self-center" aria-label={t('teams.squadSeverityWarning', 'Warning')} />
                ) : (
                  <Info size={11} className="text-gray-400 flex-shrink-0 self-center" aria-label={t('teams.squadSeverityNote', 'Note')} />
                )}
                <span className="flex-1 min-w-0">{message(w)}</span>
                {action(w)}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
