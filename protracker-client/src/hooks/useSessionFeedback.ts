import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionFeedbackApi } from '../api/sessionFeedbackApi';
import type { SubmitSessionFeedbackInput } from '../types';

// Athlete's own past sessions with their feedback (pending vs submitted).
export function useMySessionFeedback(enabled = true) {
  return useQuery({
    queryKey: ['sessionFeedback', 'mine'],
    queryFn: () => sessionFeedbackApi.getMine(),
    enabled,
  });
}

// Coach: all feedback + summary for one session.
export function useSessionFeedbackSummary(sessionId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['sessionFeedback', 'session', sessionId],
    queryFn: () => sessionFeedbackApi.getForSession(sessionId!),
    enabled: !!sessionId && enabled,
  });
}

// Coach: a player's feedback history.
export function usePlayerSessionFeedback(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['sessionFeedback', 'player', playerId],
    queryFn: () => sessionFeedbackApi.getForPlayer(playerId!),
    enabled: !!playerId && enabled,
  });
}

// Coach: team analytics for the Schedule tab.
export function useSessionFeedbackAnalytics(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['sessionFeedback', 'analytics', teamId],
    queryFn: () => sessionFeedbackApi.analytics(teamId!),
    enabled: !!teamId && enabled,
  });
}

export function useSubmitSessionFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: SubmitSessionFeedbackInput }) =>
      sessionFeedbackApi.submit(sessionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessionFeedback'] }),
  });
}
