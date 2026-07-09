import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { athleteNotesApi } from '../api/athleteNotesApi';
import type { UpsertAthleteNoteInput } from '../types';

export function useAthleteNotes(enabled = true) {
  return useQuery({
    queryKey: ['athleteNotes'],
    queryFn: () => athleteNotesApi.getMine(),
    enabled,
  });
}

export function useCreateAthleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAthleteNoteInput) => athleteNotesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athleteNotes'] }),
  });
}

export function useUpdateAthleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpsertAthleteNoteInput }) => athleteNotesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athleteNotes'] }),
  });
}

export function useDeleteAthleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => athleteNotesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['athleteNotes'] }),
  });
}
