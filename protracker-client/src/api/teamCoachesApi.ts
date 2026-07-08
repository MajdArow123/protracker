import api, { tokenStorage } from './axiosInstance';
import type {
  TeamCoach, CoachPermissions, InviteCoachInput, InviteCoachResult, ValidateCoachInvite,
} from '../types';

export interface AcceptCoachInviteInput {
  token: string;
  password?: string;
  fullName?: string;
}

interface AcceptResult {
  user: { id: string; email: string; displayName: string; roles: string[] };
  accessToken: string;
  refreshToken: string;
}

export const teamCoachesApi = {
  list: (teamId: number) => api.get<TeamCoach[]>(`/api/teams/${teamId}/coaches`).then(r => r.data),
  myPermissions: (teamId: number) =>
    api.get<CoachPermissions>(`/api/teams/${teamId}/my-coach-permissions`).then(r => r.data),
  invite: (teamId: number, data: InviteCoachInput) =>
    api.post<InviteCoachResult>(`/api/teams/${teamId}/invite-coach`, data).then(r => r.data),
  updatePermissions: (roleId: number, permissions: CoachPermissions) =>
    api.put<TeamCoach>(`/api/team-coaches/${roleId}/permissions`, permissions).then(r => r.data),
  remove: (roleId: number) => api.delete(`/api/team-coaches/${roleId}`),

  // Public.
  validate: (token: string) =>
    api.get<ValidateCoachInvite>(`/api/assistant-invites/validate/${token}`).then(r => r.data),
  accept: async (data: AcceptCoachInviteInput): Promise<AcceptResult> => {
    const res = await api.post<AcceptResult>('/api/assistant-invites/accept', data);
    tokenStorage.setAccess(res.data.accessToken);
    tokenStorage.setRefresh(res.data.refreshToken);
    return res.data;
  },
};
