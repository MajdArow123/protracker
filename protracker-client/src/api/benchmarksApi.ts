import api from './axiosInstance';
import type { BenchmarkProfile, TeamBenchmarkProfile, PlayerBenchmarks } from '../types';

export interface BenchmarkValueInput {
  metricDefinitionId: number;
  benchmarkLow: number;
  benchmarkMid: number;
  benchmarkHigh: number;
  notes?: string | null;
}

export interface CreateBenchmarkProfileInput {
  sportId: number;
  name: string;
  ageGroupMin?: number | null;
  ageGroupMax?: number | null;
  competitionLevel: string;
  basedOnProfileId?: number | null;
  values?: BenchmarkValueInput[] | null;
}

export const benchmarksApi = {
  getProfiles: (sportId: number) =>
    api.get<BenchmarkProfile[]>(`/api/benchmark-profiles?sportId=${sportId}`).then(r => r.data),
  create: (data: CreateBenchmarkProfileInput) =>
    api.post<BenchmarkProfile>('/api/benchmark-profiles', data).then(r => r.data),
  update: (id: number, data: CreateBenchmarkProfileInput) =>
    api.put<BenchmarkProfile>(`/api/benchmark-profiles/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/benchmark-profiles/${id}`),

  getTeamProfile: (teamId: number) =>
    api.get<TeamBenchmarkProfile>(`/api/teams/${teamId}/benchmark-profile`).then(r => r.data),
  setTeamProfile: (teamId: number, benchmarkProfileId: number | null) =>
    api.put<TeamBenchmarkProfile>(`/api/teams/${teamId}/benchmark-profile`, { benchmarkProfileId }).then(r => r.data),

  getPlayerBenchmarks: (playerId: number) =>
    api.get<PlayerBenchmarks>(`/api/players/${playerId}/benchmark-profile`).then(r => r.data),
};
