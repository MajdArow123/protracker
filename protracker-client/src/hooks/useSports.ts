import { useQuery } from '@tanstack/react-query';
import { sportsApi } from '../api/sportsApi';

export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn: sportsApi.getSports,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePositions(sportId: number | undefined) {
  return useQuery({
    queryKey: ['positions', sportId],
    queryFn: () => sportsApi.getPositions(sportId!),
    enabled: !!sportId,
  });
}

export function useStatCategories(sportId: number | undefined) {
  return useQuery({
    queryKey: ['statCategories', sportId],
    queryFn: () => sportsApi.getStatCategories(sportId!),
    enabled: !!sportId,
  });
}
