import api from './axiosInstance';
import type { InjuryRecord } from '../types';

export const injuryApi = {
  getForPlayer: (playerId: number) =>
    api.get<InjuryRecord[]>(`/api/injury-records/player/${playerId}`).then(r => r.data),
  create: (data: Omit<InjuryRecord, 'id'>) =>
    api.post<InjuryRecord>('/api/injury-records', data).then(r => r.data),
  update: (id: number, data: Partial<InjuryRecord>) =>
    api.put<InjuryRecord>(`/api/injury-records/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/injury-records/${id}`),
  getActive: () =>
    api.get<InjuryRecord[]>('/api/injuries/active').then(r => r.data),
  recover: (id: number) =>
    api.patch<InjuryRecord>(`/api/injuries/${id}/recover`).then(r => r.data),
};
