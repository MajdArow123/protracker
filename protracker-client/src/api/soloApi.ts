import api from './axiosInstance';
import { localDateString } from '../utils/localDate';
import type { DietaryRestrictionInput, PositionOption } from './joinApi';
import type { ScheduledSession, MatchResult } from '../types';
import type { CreateSessionInput } from './sessionsApi';
import type { CreateMatchInput } from './matchesApi';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SoloSportOption {
  id: number;
  name: string;
  positions: PositionOption[];
}

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
export type TrainingFrequency = 'Daily' | 'FewTimesWeek' | 'Weekly' | 'Occasionally';

export interface RegisterSoloPayload {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string; // yyyy-MM-dd
  height: number; // cm
  weight: number; // kg
  sportId: number;
  positionId: number;
  skillLevel: SkillLevel;
  trainingFrequency: TrainingFrequency;
  jerseyNumber?: number | null;
  goals?: string;
  motivation?: string;
  dietaryRestrictions: DietaryRestrictionInput[];
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
}

export interface RegisterSoloResult {
  user: { id: string; email: string; displayName: string; roles: string[] };
  playerId: number;
  sportName: string;
}

export interface SoloProfile {
  id: number;
  playerId: number;
  sportId: number;
  sportName: string;
  skillLevel: SkillLevel;
  trainingFrequency: TrainingFrequency;
  goals: string | null;
  motivation: string | null;
  createdAt: string;
}

export interface ConnectCoachResult {
  user: { id: string; email: string; displayName: string; roles: string[] };
  teamName: string;
  teamId: number;
  playerId: number;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const soloApi = {
  // Public — powers the sport/position steps of the registration wizard.
  getSports: async (): Promise<SoloSportOption[]> => {
    const res = await api.get<SoloSportOption[]>('/api/solo/sports');
    return res.data;
  },

  // Creates the solo account + player + solo profile. The caller follows up with a
  // normal login() so AuthContext/session handling stays on the single existing path.
  registerSolo: async (payload: RegisterSoloPayload): Promise<RegisterSoloResult> => {
    const res = await api.post<RegisterSoloResult>('/api/auth/register-solo', payload);
    return res.data;
  },

  // ── Authenticated (SoloAthlete) ────────────────────────────────────────────

  getProfile: async (): Promise<SoloProfile> => {
    const res = await api.get<SoloProfile>('/api/solo/profile');
    return res.data;
  },

  updateProfile: async (patch: Partial<Pick<SoloProfile, 'skillLevel' | 'trainingFrequency' | 'goals' | 'motivation'>>): Promise<SoloProfile> => {
    const res = await api.put<SoloProfile>('/api/solo/profile', patch);
    return res.data;
  },

  // Personal (player-scoped, team-less) training sessions & matches.
  getSessions: (): Promise<ScheduledSession[]> =>
    api.get<ScheduledSession[]>('/api/solo/sessions').then(r => r.data),

  createSession: (data: CreateSessionInput): Promise<ScheduledSession> =>
    api.post<ScheduledSession>('/api/solo/sessions', data).then(r => r.data),

  getMatches: (): Promise<MatchResult[]> =>
    api.get<MatchResult[]>('/api/solo/matches').then(r => r.data),

  createMatch: (data: CreateMatchInput & { personalRating?: number }): Promise<MatchResult> =>
    api.post<MatchResult>('/api/solo/matches', data).then(r => r.data),

  // Converts the solo account into a coach-managed athlete. The role changes, so the
  // backend issues fresh tokens — the caller must store them and re-bootstrap auth.
  connectCoach: async (code: string): Promise<ConnectCoachResult & { accessToken: string; refreshToken: string }> => {
    const res = await api.post<ConnectCoachResult & { accessToken: string; refreshToken: string }>('/api/solo/connect-coach', { code, localDate: localDateString() });
    return res.data;
  },
};
