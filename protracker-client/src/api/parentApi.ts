import api from './axiosInstance';
import type {
  ParentChild, ChildOverview, ParentInviteInfo, ParentInviteResult, PlayerParent,
} from '../types';

export interface InviteParentInput {
  playerId: number;
  email: string;
  parentName: string;
}

export const parentApi = {
  // Coach
  invite: (data: InviteParentInput) =>
    api.post<ParentInviteResult>('/api/parents/invite', data).then(r => r.data),
  getPlayerParents: (playerId: number) =>
    api.get<PlayerParent[]>(`/api/players/${playerId}/parents`).then(r => r.data),

  // Public (invite acceptance)
  validateInvite: (token: string) =>
    api.get<ParentInviteInfo>(`/api/parents/validate-invite?token=${encodeURIComponent(token)}`).then(r => r.data),
  acceptInvite: (token: string, password: string) =>
    api.post('/api/parents/accept-invite', { token, password }).then(r => r.data),

  // Parent
  getChildren: () => api.get<ParentChild[]>('/api/parent/children').then(r => r.data),
  getChild: (playerId: number) =>
    api.get<ChildOverview>(`/api/parent/children/${playerId}`).then(r => r.data),
};
