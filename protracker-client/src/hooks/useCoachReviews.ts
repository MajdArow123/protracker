import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '../api/reviewsApi';
import type { SubmitCoachReviewInput } from '../types';

export function useCoachReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ['coachReviews', slug],
    queryFn: () => reviewsApi.forCoach(slug!),
    enabled: !!slug,
  });
}

export function useSubmitReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitCoachReviewInput) => reviewsApi.submit(slug, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coachReviews', slug] });
      qc.invalidateQueries({ queryKey: ['coachPublicProfile', 'view', slug] });
    },
  });
}

export function useRespondToReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) => reviewsApi.respond(id, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coachReviews', slug] }),
  });
}

export function useDeleteReview(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reviewsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coachReviews', slug] });
      qc.invalidateQueries({ queryKey: ['coachPublicProfile', 'view', slug] });
    },
  });
}
