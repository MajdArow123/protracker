import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentApi, type InviteParentInput } from '../api/parentApi';
import type { ParentChild, ChildOverview, PlayerParent } from '../types';

export function useChildren() {
  return useQuery<ParentChild[]>({
    queryKey: ['parent-children'],
    queryFn: parentApi.getChildren,
  });
}

export function useChildOverview(playerId: number | undefined) {
  return useQuery<ChildOverview>({
    queryKey: ['parent-child', playerId],
    queryFn: () => parentApi.getChild(playerId!),
    enabled: !!playerId,
  });
}

// Coach-side: parents linked to / invited for a player.
export function usePlayerParents(playerId: number | undefined, enabled = true) {
  return useQuery<PlayerParent[]>({
    queryKey: ['player-parents', playerId],
    queryFn: () => parentApi.getPlayerParents(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function useInviteParent(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteParentInput) => parentApi.invite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['player-parents', playerId] }),
  });
}
