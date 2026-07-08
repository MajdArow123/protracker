import api from './axiosInstance';
import type { Drill, PagedResult, DrillCategory, DrillDifficulty, TaskPriority, PlayerTask, DrillUsage, DrillAnalytics } from '../types';

export interface DrillFilters {
  sport?: number | null;
  category?: DrillCategory | null;
  difficulty?: DrillDifficulty | null;
  search?: string;
  favorited?: boolean;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateDrillInput {
  name: string;
  description?: string | null;
  sportIds: number[];
  category: DrillCategory;
  difficulty: DrillDifficulty;
  durationMinutes?: number | null;
  equipment?: string | null;
  instructions?: string | null;
  videoUrl?: string | null;
  targetStatCategories: string[];
}

export interface AssignDrillInput {
  playerId: number;
  dueDate?: string | null;
  priority: TaskPriority;
  note?: string | null;
}

function toQuery(f: DrillFilters): string {
  const q = new URLSearchParams();
  if (f.sport != null) q.set('sport', String(f.sport));
  if (f.category) q.set('category', f.category);
  if (f.difficulty) q.set('difficulty', f.difficulty);
  if (f.search) q.set('search', f.search);
  if (f.favorited) q.set('favorited', 'true');
  if (f.mine) q.set('mine', 'true');
  if (f.page) q.set('page', String(f.page));
  if (f.pageSize) q.set('pageSize', String(f.pageSize));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const drillsApi = {
  list: (filters: DrillFilters = {}) =>
    api.get<PagedResult<Drill>>(`/api/drills${toQuery(filters)}`).then(r => r.data),
  recommended: (playerId: number) =>
    api.get<PagedResult<Drill>>(`/api/drills?recommended=true&playerId=${playerId}&pageSize=6`).then(r => r.data),
  get: (id: number) => api.get<Drill>(`/api/drills/${id}`).then(r => r.data),
  stats: (id: number) => api.get<DrillUsage>(`/api/drills/${id}/stats`).then(r => r.data),
  analytics: () => api.get<DrillAnalytics>('/api/drills/analytics').then(r => r.data),
  favorites: () => api.get<Drill[]>('/api/drills/favorites').then(r => r.data),
  create: (data: CreateDrillInput) => api.post<Drill>('/api/drills', data).then(r => r.data),
  update: (id: number, data: CreateDrillInput) => api.put<Drill>(`/api/drills/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/drills/${id}`),
  toggleFavorite: (id: number) =>
    api.post<{ isFavorited: boolean }>(`/api/drills/${id}/favorite`, {}).then(r => r.data),
  assign: (id: number, data: AssignDrillInput) =>
    api.post<PlayerTask>(`/api/drills/${id}/assign`, data).then(r => r.data),
};
