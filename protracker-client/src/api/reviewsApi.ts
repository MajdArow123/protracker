import api from './axiosInstance';
import type { CoachReview, CoachReviewsResponse, SubmitCoachReviewInput } from '../types';

export const reviewsApi = {
  forCoach: (slug: string) =>
    api.get<CoachReviewsResponse>(`/api/coaches/${slug}/reviews`).then(r => r.data),
  submit: (slug: string, data: SubmitCoachReviewInput) =>
    api.post<CoachReview>(`/api/coaches/${slug}/reviews`, data).then(r => r.data),
  respond: (id: number, response: string) =>
    api.put<CoachReview>(`/api/coach-reviews/${id}/response`, { response }).then(r => r.data),
  delete: (id: number) => api.delete(`/api/coach-reviews/${id}`),
};
