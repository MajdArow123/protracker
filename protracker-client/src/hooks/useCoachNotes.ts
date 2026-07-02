import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachNotesApi, type CreateCoachNoteInput } from '../api/coachNotesApi';

export function useCoachNotes(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['coachNotes', playerId],
    queryFn: () => coachNotesApi.getForPlayer(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function useCreateCoachNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, data }: { playerId: number; data: CreateCoachNoteInput }) => coachNotesApi.create(playerId, data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['coachNotes', v.playerId] }),
  });
}

export function useUpdateCoachNote(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateCoachNoteInput }) => coachNotesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachNotes', playerId] }),
  });
}

export function useDeleteCoachNote(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => coachNotesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachNotes', playerId] }),
  });
}
