import { useState } from 'react';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Modal, ConfirmModal } from '../ui/Modal';
import { useToast } from '../../context/useToast';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { usePlayers } from '../../hooks/usePlayers';
import { usePositions } from '../../hooks/useSports';
import { useTeams } from '../../hooks/useTeams';
import { useSeasonRoster, useSaveStint, useDeleteStint } from '../../hooks/useSeasons';
import { groupStintsByTeam } from '../../utils/seasonRoster';
import type { Season, SeasonRosterStint, SeasonRosterSaveResult, SeasonTeamRef } from '../../types';

const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// ── Add/edit one roster stint ────────────────────────────────────────────────
function StintFormModal({ season, team, editing, onClose, onSaved }: {
  season: Season;
  team: SeasonTeamRef;
  editing: SeasonRosterStint | null;
  onClose: () => void;
  onSaved: (result: SeasonRosterSaveResult) => void;
}) {
  const { t: tr } = useTranslation();
  const { addToast } = useToast();
  const save = useSaveStint();
  const { data: allPlayers = [] } = usePlayers();
  const { data: teams = [] } = useTeams();
  const sportId = teams.find(t => t.id === team.id)?.sportId;
  const { data: positions = [] } = usePositions(sportId);

  // Current team members only — historical stints for players who already left the
  // club arrive with S7 backfill tooling, not here.
  const candidates = allPlayers
    .filter(p => p.teamId === team.id)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const [playerId, setPlayerId] = useState<number | ''>(editing?.playerId ?? '');
  // Ruling: JoinedAt defaults to the season's start date — almost always right,
  // harmless when wrong, and editable.
  const [joinedAt, setJoinedAt] = useState(
    editing?.joinedAt?.slice(0, 10) ?? season.startDate.slice(0, 10));
  const [leftAt, setLeftAt] = useState(editing?.leftAt?.slice(0, 10) ?? '');
  const [jersey, setJersey] = useState<string>(editing?.jerseyNumber != null ? String(editing.jerseyNumber) : '');
  const [positionId, setPositionId] = useState<number | ''>(editing?.positionId ?? '');

  async function submit() {
    if (playerId === '') {
      addToast(tr('seasons.errPlayerRequired', 'Pick a player.'), 'error');
      return;
    }
    if (!joinedAt) {
      addToast(tr('seasons.errJoinRequired', 'A join date is required.'), 'error');
      return;
    }
    if (leftAt && leftAt < joinedAt) {
      addToast(tr('seasons.errLeftBeforeJoin', 'The leave date must be on or after the join date.'), 'error');
      return;
    }
    try {
      const result = await save.mutateAsync({
        seasonId: season.id,
        stintId: editing?.id,
        data: {
          playerId,
          teamId: team.id,
          joinedAt,
          leftAt: leftAt || null,
          jerseyNumber: jersey === '' ? null : Number(jersey),
          positionId: positionId === '' ? null : positionId,
        },
      });
      onSaved(result);
    } catch (err) {
      // Ruling: roster writes never silently fail — the server's 400 (overlap naming
      // the conflicting stint, participation, dates) surfaces verbatim.
      const message = err instanceof Error && err.message
        ? err.message
        : tr('seasons.errStintSave', 'Could not save the roster entry.');
      addToast(message, 'error');
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing
        ? tr('seasons.editStintTitle', 'Edit roster entry')
        : tr('seasons.addStintTitle', 'Add to season roster')}
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{team.name}</p>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.player', 'Player')}</label>
          {editing ? (
            <p className="text-sm text-gray-900 dark:text-gray-100 font-medium py-2">{editing.playerName}</p>
          ) : (
            <select
              className={inputClass}
              value={playerId}
              onChange={e => setPlayerId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{tr('seasons.pickPlayer', 'Pick a player…')}</option>
              {candidates.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr('seasons.joinedDate', 'Joined')}</label>
            <input type="date" className={inputClass} value={joinedAt} onChange={e => setJoinedAt(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('seasons.leftDate', 'Left')} <span className="text-gray-400 font-normal">({tr('common.optional', 'Optional')})</span>
            </label>
            <input type="date" className={inputClass} value={leftAt} onChange={e => setLeftAt(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr('seasons.joinDefaultHint', 'Joined defaults to the season start — change it if the player arrived later. Leave "Left" empty while the player is still on the team.')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('seasons.jersey', 'Jersey #')} <span className="text-gray-400 font-normal">({tr('common.optional', 'Optional')})</span>
            </label>
            <input
              type="number"
              min={0}
              max={999}
              className={inputClass}
              value={jersey}
              onChange={e => setJersey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr('seasons.position', 'Position')} <span className="text-gray-400 font-normal">({tr('common.optional', 'Optional')})</span>
            </label>
            <select
              className={inputClass}
              value={positionId}
              onChange={e => setPositionId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">—</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel', 'Cancel')}</Button>
          <Button type="button" onClick={submit} isLoading={save.isPending}>{tr('common.save', 'Save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── The per-season roster section (inside SeasonDetail) ──────────────────────
export function SeasonRosterSection({ season }: { season: Season }) {
  const { t: tr } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const fmtDate = (iso: string) => formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const { addToast } = useToast();
  const { data: stints = [], isLoading, isError, refetch } = useSeasonRoster(season.id);
  const del = useDeleteStint();

  const [formTarget, setFormTarget] = useState<{ team: SeasonTeamRef; editing: SeasonRosterStint | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SeasonRosterStint | null>(null);
  const [unstamped, setUnstamped] = useState<{ count: number; playerName: string } | null>(null);

  const groups = groupStintsByTeam(season.teams, stints);
  const multiTeam = groups.length > 1;

  function handleSaved(result: SeasonRosterSaveResult) {
    setFormTarget(null);
    // Ruling 3 made visible: saving a stint never rewrites history — say how much
    // existing data sits inside the window, and that backfill tooling is coming.
    if (result.unstampedInWindow > 0) {
      setUnstamped({ count: result.unstampedInWindow, playerName: result.stint.playerName });
    } else {
      addToast(tr('seasons.stintSaved', 'Roster entry saved'), 'success');
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      addToast(tr('seasons.stintDeleted', 'Roster entry removed'), 'success');
    } catch {
      addToast(tr('seasons.errStintDelete', 'Could not remove the roster entry.'), 'error');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
        <Users size={13} /> {tr('seasons.rosterTitle', 'Season Roster')}
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">{tr('common.loading', 'Loading...')}</p>
      ) : isError ? (
        // A load failure is never a "no players" claim.
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr('seasons.errRosterLoad', "Couldn't load the season roster.")}{' '}
          <button onClick={() => refetch()} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
            {tr('common.retry', 'Retry')}
          </button>
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.team.id}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                {multiTeam ? (
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{group.team.name}</p>
                ) : <span />}
                <Button type="button" size="sm" variant="secondary" onClick={() => setFormTarget({ team: group.team, editing: null })}>
                  <Plus size={13} /> {tr('seasons.addPlayer', 'Add player')}
                </Button>
              </div>
              {group.stints.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {tr('seasons.noStints', 'No roster entries yet. Add the players who were on this team during the season — their records get assigned to it from the entry dates onward.')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {group.stints.map(stint => (
                    <div
                      key={stint.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{stint.playerName}</span>
                        {stint.jerseyNumber != null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums" dir="ltr">#{stint.jerseyNumber}</span>
                        )}
                        {stint.positionName && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{stint.positionName}</span>
                        )}
                        <span className={clsx('text-xs', stint.leftAt ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400')}>
                          {fmtDate(stint.joinedAt)} – {stint.leftAt ? fmtDate(stint.leftAt) : tr('seasons.present', 'present')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setFormTarget({ team: group.team, editing: stint })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          aria-label={tr('common.edit', 'Edit')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(stint)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          aria-label={tr('common.delete', 'Delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-gray-400">
            {tr('seasons.rosterExplainer', 'Roster history decides which season a player’s new records are assigned to. Existing records are not re-assigned — backfill tooling is coming in a future update.')}
          </p>
        </div>
      )}

      {formTarget && (
        <StintFormModal
          season={season}
          team={formTarget.team}
          editing={formTarget.editing}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title={tr('seasons.deleteStintTitle', 'Remove roster entry?')}
        message={tr(
          'seasons.deleteStintMsg',
          '{{name}}’s entry on {{team}} will be removed. Records already assigned to this season keep their assignment.',
          { name: confirmDelete?.playerName, team: confirmDelete?.teamName },
        )}
        confirmLabel={tr('common.delete', 'Delete')}
        isLoading={del.isPending}
      />

      {unstamped && (
        <Modal isOpen onClose={() => setUnstamped(null)} title={tr('seasons.unstampedTitle', 'Existing records not assigned')}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {unstamped.count === 1
                ? tr(
                    'seasons.unstampedMsgOne',
                    'Roster entry saved. One existing record of {{name}}’s falls inside these dates but stays unassigned — adding a roster entry never rewrites history. Backfill tooling is coming in a future update.',
                    { name: unstamped.playerName },
                  )
                : tr(
                    'seasons.unstampedMsg',
                    'Roster entry saved. {{num}} existing records of {{name}}’s fall inside these dates but stay unassigned — adding a roster entry never rewrites history. Backfill tooling is coming in a future update.',
                    { num: unstamped.count, name: unstamped.playerName },
                  )}
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setUnstamped(null)}>{tr('common.done', 'Done')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
