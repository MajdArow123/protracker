import api from './axiosInstance';
import type { TeamAnnouncement, AnnouncementPriority } from '../types';

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
}

export const announcementsApi = {
  getForTeam: (teamId: number) =>
    api.get<TeamAnnouncement[]>(`/api/teams/${teamId}/announcements`).then(r => r.data),
  getMine: () =>
    api.get<TeamAnnouncement[]>(`/api/announcements/mine`).then(r => r.data),
  create: (teamId: number, data: CreateAnnouncementInput) =>
    api.post<TeamAnnouncement>(`/api/teams/${teamId}/announcements`, data).then(r => r.data),
  update: (id: number, data: CreateAnnouncementInput) =>
    api.put<TeamAnnouncement>(`/api/announcements/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/announcements/${id}`),
};
