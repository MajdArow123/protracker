import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { SourceBadge } from '../../ui/SourceBadge';
import { tacticalCatalogForSport, roleLabel, tacticalLabelText, setPieceLabel } from './tacticalCatalog';
import type { TacticalState } from './lineupTacticalLogic';

// The coach-authored tactical layer's UI (Phase 3). Everything here is
// coach-entered vocabulary — presentation-only, never a simulation input.
// Every control commits through `onChange` (one reducer apply = one undo
// step); the notes field commits on BLUR so typing never floods the history.
// Set-piece / role / captain options are the CURRENT XI only — eligibility
// mirrors the server rule, and pruning keeps it true across swaps.

export interface XiEntry {
  playerId: number;
  name: string;
  slotKey: string;
  slotAbbr: string;
}

interface PanelProps {
  sportId: number;
  xi: XiEntry[];
  tactical: TacticalState;
  onChange: (mutate: (t: TacticalState) => TacticalState) => void;
}

const selectCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer';

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
      {children}
    </label>
  );
}

export function TacticsPanel({ sportId, xi, tactical, onChange }: PanelProps) {
  const { t } = useTranslation();
  const catalog = tacticalCatalogForSport(sportId);

  // Notes commit on blur — one undo step per edit session, never per keystroke.
  const [notesDraft, setNotesDraft] = useState(tactical.notes);
  useEffect(() => setNotesDraft(tactical.notes), [tactical.notes]);

  const playerOptions = (excludeId: number | null) =>
    xi.filter(p => p.playerId !== excludeId)
      .map(p => ({ value: String(p.playerId), label: `${p.slotAbbr} · ${p.name}` }));

  const setCaptain = (value: string) =>
    onChange(prev => ({ ...prev, captainId: value ? Number(value) : null }));
  const setVice = (value: string) =>
    onChange(prev => ({ ...prev, viceCaptainId: value ? Number(value) : null }));
  const setRole = (slotKey: string, value: string) =>
    onChange(prev => {
      const roles = { ...prev.roles };
      if (value) roles[slotKey] = value; else delete roles[slotKey];
      return { ...prev, roles };
    });
  const setTaker = (type: string, value: string) =>
    onChange(prev => {
      const setPieces = { ...prev.setPieces };
      if (value) setPieces[type] = Number(value); else delete setPieces[type];
      return { ...prev, setPieces };
    });
  const toggleLabel = (key: string) =>
    onChange(prev => ({
      ...prev,
      labels: prev.labels.includes(key) ? prev.labels.filter(l => l !== key) : [...prev.labels, key],
    }));

  return (
    <section
      aria-label={t('teams.lineupTactics', 'Tactics')}
      className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
        {t('teams.lineupTactics', 'Tactics')}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Captaincy — eligible-from-XI only, captain ≠ vice by construction */}
        <div>
          <FieldLabel htmlFor="lineup-captain">{t('teams.lineupCaptain', 'Captain')}</FieldLabel>
          <select
            id="lineup-captain"
            value={tactical.captainId ?? ''}
            onChange={e => setCaptain(e.target.value)}
            className={selectCls}
          >
            <option value="">{t('teams.lineupNoCaptain', 'No captain')}</option>
            {playerOptions(tactical.viceCaptainId).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="lineup-vice">{t('teams.lineupViceCaptain', 'Vice-captain')}</FieldLabel>
          <select
            id="lineup-vice"
            value={tactical.viceCaptainId ?? ''}
            onChange={e => setVice(e.target.value)}
            className={selectCls}
          >
            <option value="">{t('teams.lineupNoViceCaptain', 'No vice-captain')}</option>
            {playerOptions(tactical.captainId).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Set pieces — sports without taker types skip the section entirely */}
      {catalog.setPieceTypes.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
            {t('teams.lineupSetPieces', 'Set pieces')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {catalog.setPieceTypes.map(type => (
              <div key={type}>
                <FieldLabel htmlFor={`sp-${type}`}>{setPieceLabel(t, type)}</FieldLabel>
                <select
                  id={`sp-${type}`}
                  value={tactical.setPieces[type] ?? ''}
                  onChange={e => setTaker(type, e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t('teams.lineupNoTaker', 'Not assigned')}</option>
                  {playerOptions(null).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-slot roles — preset vocabulary, opaque keys server-side */}
      {catalog.roles.length > 0 && xi.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
            {t('teams.lineupRoles', 'Roles')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {xi.map(p => (
              <div key={p.slotKey} className="flex items-center gap-2">
                <span className="w-24 flex-shrink-0 text-[11px] text-gray-600 dark:text-gray-300 truncate">
                  <b className="text-gray-400 me-1">{p.slotAbbr}</b>{p.name}
                </span>
                <select
                  aria-label={t('teams.lineupRoleFor', 'Role for {{name}}', { name: p.name })}
                  value={tactical.roles[p.slotKey] ?? ''}
                  onChange={e => setRole(p.slotKey, e.target.value)}
                  className={selectCls}
                >
                  <option value="">{t('teams.lineupNoRole', 'No role')}</option>
                  {catalog.roles.map(r => (
                    <option key={r} value={r}>{roleLabel(t, r)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tactical labels — presentation-only chips */}
      {catalog.labels.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
            {t('teams.lineupTacticalLabels', 'Tactical labels')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.labels.map(key => {
              const active = tactical.labels.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLabel(key)}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer',
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400',
                  )}
                >
                  {tacticalLabelText(t, key)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes — committed on blur (one undo step per edit session) */}
      <div className="mt-4">
        <FieldLabel htmlFor="lineup-notes">{t('teams.lineupNotes', 'Lineup notes')}</FieldLabel>
        <textarea
          id="lineup-notes"
          value={notesDraft}
          maxLength={2000}
          rows={2}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={() => onChange(prev => ({ ...prev, notes: notesDraft }))}
          placeholder={t('teams.lineupNotesPlaceholder', 'Plan, reminders, matchday instructions…')}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
    </section>
  );
}

// ── View-mode summary (read-only, provenance-badged) ─────────────────────────

interface SummaryProps {
  sportId: number;
  tactical: TacticalState;
  nameOf: (id?: number | null) => string;
}

export function TacticsSummary({ sportId, tactical, nameOf }: SummaryProps) {
  const { t } = useTranslation();
  const catalog = tacticalCatalogForSport(sportId);
  const roleEntries = Object.entries(tactical.roles);
  const setPieceEntries = catalog.setPieceTypes
    .filter(type => type in tactical.setPieces)
    .map(type => [type, tactical.setPieces[type]] as const);

  return (
    <section
      aria-label={t('teams.lineupTactics', 'Tactics')}
      className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
          {t('teams.lineupTactics', 'Tactics')}
        </h4>
        <SourceBadge source="coach-entered" size="xs" />
      </div>

      <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
        {(tactical.captainId != null || tactical.viceCaptainId != null) && (
          <p>
            {tactical.captainId != null && (
              <span className="me-4">
                <b className="text-yellow-600 dark:text-yellow-400">C</b> {nameOf(tactical.captainId)}
              </span>
            )}
            {tactical.viceCaptainId != null && (
              <span>
                <b className="text-yellow-600 dark:text-yellow-400">VC</b> {nameOf(tactical.viceCaptainId)}
              </span>
            )}
          </p>
        )}

        {tactical.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tactical.labels.map(key => (
              <span key={key} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">
                {tacticalLabelText(t, key)}
              </span>
            ))}
          </div>
        )}

        {setPieceEntries.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {setPieceEntries
              .map(([type, playerId]) => `${setPieceLabel(t, type)}: ${nameOf(playerId)}`)
              .join(' · ')}
          </p>
        )}

        {roleEntries.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {roleEntries
              .map(([slotKey, role]) => `${slotKey} ${roleLabel(t, role)}`)
              .join(' · ')}
          </p>
        )}

        {tactical.notes.trim().length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{tactical.notes}</p>
        )}
      </div>
    </section>
  );
}
