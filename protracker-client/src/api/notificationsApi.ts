import api from './axiosInstance';
import type { NotificationPage } from '../types';

export const notificationsApi = {
  list: (page = 1, unreadOnly = false) =>
    api.get<NotificationPage>(`/api/notifications?page=${page}&unreadOnly=${unreadOnly}`).then(r => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count').then(r => r.data.count),
  markRead: (id: number) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch<{ updated: number }>('/api/notifications/read-all').then(r => r.data),
  remove: (id: number) => api.delete(`/api/notifications/${id}`),
};
