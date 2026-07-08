import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '../api/playersApi';
import type { Player } from '../types';

export function usePlayers(enabled = true) {
  return useQuery({
    queryKey: ['players'],
    queryFn: playersApi.getPlayers,
    staleTime: 60_000,
    enabled,
  });
}

// The current athlete/solo athlete's own player record (id + sport, etc.) via /api/players/me.
export function useMyPlayer(enabled = true) {
  return useQuery({
    queryKey: ['players', 'me'],
    queryFn: playersApi.getMyPlayer,
    enabled,
    staleTime: 60_000,
  });
}

export function usePlayer(id: number | undefined) {
  return useQuery({
    queryKey: ['players', id],
    queryFn: () => playersApi.getPlayer(id!),
    enabled: !!id,
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: playersApi.createPlayer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Player> }) =>
      playersApi.updatePlayer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: playersApi.deletePlayer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  });
}
