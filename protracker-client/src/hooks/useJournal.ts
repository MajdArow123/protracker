import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalApi, type UpsertJournalInput } from '../api/journalApi';

export function useMyJournal(days = 90, enabled = true) {
  return useQuery({
    queryKey: ['journal', 'mine', days],
    queryFn: () => journalApi.getMine(days),
    enabled,
  });
}

export function useTodayJournal(enabled = true) {
  return useQuery({
    queryKey: ['journal', 'today'],
    queryFn: journalApi.getToday,
    enabled,
  });
}

export function usePlayerJournal(playerId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['journal', 'player', playerId],
    queryFn: () => journalApi.getForPlayer(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function useUpsertJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertJournalInput) => journalApi.upsertToday(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpsertJournalInput }) => journalApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => journalApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}
