import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentTemplatesApi, type CreateTemplateInput } from '../api/assessmentTemplatesApi';

export function useAssessmentTemplates(sportId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['assessmentTemplates', sportId ?? null],
    queryFn: () => assessmentTemplatesApi.list(sportId),
    enabled,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateInput) => assessmentTemplatesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessmentTemplates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateTemplateInput }) => assessmentTemplatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessmentTemplates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessmentTemplates'] }),
  });
}
