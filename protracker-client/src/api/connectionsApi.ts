import api from './axiosInstance';
import type {
  ConnectionRequest, MyConnectionRequest, SendConnectionRequestInput, ConnectionRequestStatus,
} from '../types';

export const connectionsApi = {
  // Athlete / solo.
  send: (slug: string, data: SendConnectionRequestInput) =>
    api.post<MyConnectionRequest>(`/api/coaches/${slug}/request`, data).then(r => r.data),
  mine: () => api.get<MyConnectionRequest[]>('/api/athlete/connection-requests').then(r => r.data),
  withdraw: (id: number) => api.delete(`/api/athlete/connection-requests/${id}`),

  // Coach.
  incoming: (status?: ConnectionRequestStatus) =>
    api.get<ConnectionRequest[]>(`/api/coach/connection-requests${status ? `?status=${status}` : ''}`).then(r => r.data),
  accept: (id: number) =>
    api.patch<ConnectionRequest>(`/api/coach/connection-requests/${id}/accept`).then(r => r.data),
  decline: (id: number, reason?: string) =>
    api.patch<ConnectionRequest>(`/api/coach/connection-requests/${id}/decline`, { reason }).then(r => r.data),
};
