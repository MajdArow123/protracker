import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionsApi } from '../api/connectionsApi';
import type { ConnectionRequestStatus, SendConnectionRequestInput } from '../types';

// Coach: incoming requests (all, or filtered by status).
export function useIncomingRequests(status?: ConnectionRequestStatus, enabled = true) {
  return useQuery({
    queryKey: ['connections', 'incoming', status ?? 'all'],
    queryFn: () => connectionsApi.incoming(status),
    enabled,
  });
}

// Athlete/solo: requests I've sent.
export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: ['connections', 'mine'],
    queryFn: () => connectionsApi.mine(),
    enabled,
  });
}

export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: SendConnectionRequestInput }) => connectionsApi.send(slug, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => connectionsApi.accept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => connectionsApi.decline(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useWithdrawRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => connectionsApi.withdraw(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}
