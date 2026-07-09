import api from './axiosInstance';
import type {
  CoachPublicProfileSettings, UpdateCoachPublicProfileInput, CoachMarketplaceItem,
  CoachPublicProfileView, CoachMarketplaceQuery, PagedResult,
} from '../types';

function buildQuery(q: CoachMarketplaceQuery): string {
  const p = new URLSearchParams();
  if (q.sport != null) p.set('sport', String(q.sport));
  if (q.city) p.set('city', q.city);
  if (q.country) p.set('country', q.country);
  if (q.accepting) p.set('accepting', 'true');
  if (q.search) p.set('search', q.search);
  if (q.minYears != null) p.set('minYears', String(q.minYears));
  if (q.maxYears != null) p.set('maxYears', String(q.maxYears));
  if (q.sort) p.set('sort', q.sort);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const coachesApi = {
  // Public marketplace listing + profile (no auth).
  list: (q: CoachMarketplaceQuery) =>
    api.get<PagedResult<CoachMarketplaceItem>>(`/api/coaches${buildQuery(q)}`).then(r => r.data),
  getPublic: (slug: string) =>
    api.get<CoachPublicProfileView>(`/api/coaches/${slug}`).then(r => r.data),

  // The coach's own public-profile settings.
  getSettings: () => api.get<CoachPublicProfileSettings>('/api/profile/coach-public').then(r => r.data),
  updateSettings: (data: UpdateCoachPublicProfileInput) =>
    api.put<CoachPublicProfileSettings>('/api/profile/coach-public', data).then(r => r.data),
};
