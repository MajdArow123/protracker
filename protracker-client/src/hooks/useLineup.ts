import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSeasonNoticeToast } from './useSeasonNotice';
import { lineupApi, tacticalPresetApi, type SaveLineupInput, type SaveTacticalPresetInput } from '../api/lineupApi';
import {
  contextKey, contextRequestParams, type LineupContext,
} from '../components/teams/lineup/lineupWorkflowLogic';

// Phase 6: lineups are addressed by a typed context (default | named | match).
// contextKey is cache-parity-pinned: default/match keys are byte-identical to
// the pre-Phase-6 ['lineup', teamId, matchId ?? 'default'] shape.

/** The context a saved/echoed LineupDto belongs to (name wins the two-key model). */
function contextOfDto(dto: { matchResultId: number | null; name?: string | null }): LineupContext {
  if (dto.matchResultId != null) return { kind: 'match', matchId: dto.matchResultId };
  if (dto.name != null && dto.name.length > 0) return { kind: 'named', name: dto.name };
  return { kind: 'default' };
}

export function useLineup(teamId: number | null | undefined, ctx: LineupContext, enabled = true) {
  return useQuery({
    queryKey: contextKey(teamId ?? 0, ctx),
    queryFn: () => lineupApi.get(teamId!, contextRequestParams(ctx)),
    enabled: !!teamId && enabled,
  });
}

/** Every saved lineup for the team — powers the picker + named cap. */
export function useTeamLineups(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['lineups', teamId ?? 0],
    queryFn: () => lineupApi.list(teamId!),
    enabled: !!teamId && enabled,
  });
}

export function useSaveLineup(teamId: number) {
  const qc = useQueryClient();
  const notifySeason = useSeasonNoticeToast();
  return useMutation({
    mutationFn: (data: SaveLineupInput) => lineupApi.save(teamId, data),
    onSuccess: saved => {
      notifySeason(saved);
      qc.setQueryData(contextKey(teamId, contextOfDto(saved)), saved);
      void qc.invalidateQueries({ queryKey: ['lineups', teamId] });
      void qc.invalidateQueries({ queryKey: ['lineupAudit', teamId] });
    },
  });
}

export function useResetLineup(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ctx: LineupContext) => lineupApi.reset(teamId, contextRequestParams(ctx)),
    onSuccess: (_res, ctx) => {
      qc.setQueryData(contextKey(teamId, ctx), null);
      void qc.invalidateQueries({ queryKey: ['lineups', teamId] });
      void qc.invalidateQueries({ queryKey: ['lineupAudit', teamId] });
    },
  });
}

/** publish=true → POST publish, else unpublish. The server is the real gate. */
export function useSetLineupStatus(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineupId, publish }: { lineupId: number; publish: boolean }) =>
      publish ? lineupApi.publish(lineupId) : lineupApi.unpublish(lineupId),
    onSuccess: updated => {
      qc.setQueryData(contextKey(teamId, contextOfDto(updated)), updated);
      void qc.invalidateQueries({ queryKey: ['lineups', teamId] });
      void qc.invalidateQueries({ queryKey: ['lineupAudit', teamId] });
    },
  });
}

/** Read-only change audit, newest first, paged (restore/compare deferred). */
export function useLineupAudit(teamId: number | null | undefined, page: number, enabled = true) {
  return useQuery({
    queryKey: ['lineupAudit', teamId ?? 0, page],
    queryFn: () => lineupApi.audit(teamId!, { page }),
    enabled: !!teamId && enabled,
  });
}

// ── Tactical presets ─────────────────────────────────────────────────────────

export function useTacticalPresets(sportId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['tacticalPresets', sportId ?? 0],
    queryFn: () => tacticalPresetApi.getMine(sportId),
    enabled: !!sportId && enabled,
  });
}

export function useTacticalPresetMutations(sportId: number) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['tacticalPresets', sportId] });
  const create = useMutation({
    mutationFn: (data: SaveTacticalPresetInput) => tacticalPresetApi.create(data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveTacticalPresetInput }) => tacticalPresetApi.update(id, data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => tacticalPresetApi.remove(id),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
