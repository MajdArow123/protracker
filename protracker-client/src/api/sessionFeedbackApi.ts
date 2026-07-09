import api from './axiosInstance';
import type {
  SessionFeedback, SubmitSessionFeedbackInput, SessionFeedbackSummary,
  MySessionFeedback, SessionFeedbackAnalytics,
} from '../types';

export const sessionFeedbackApi = {
  submit: (sessionId: number, data: SubmitSessionFeedbackInput) =>
    api.post<SessionFeedback>(`/api/sessions/${sessionId}/feedback`, data).then(r => r.data),
  getForSession: (sessionId: number) =>
    api.get<SessionFeedbackSummary>(`/api/sessions/${sessionId}/feedback`).then(r => r.data),
  getForPlayer: (playerId: number) =>
    api.get<SessionFeedback[]>(`/api/players/${playerId}/session-feedback`).then(r => r.data),
  getMine: () =>
    api.get<MySessionFeedback[]>(`/api/sessions/feedback/mine`).then(r => r.data),
  analytics: (teamId: number) =>
    api.get<SessionFeedbackAnalytics>(`/api/teams/${teamId}/session-feedback-analytics`).then(r => r.data),
};
