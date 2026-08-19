import api from './axiosInstance';
import { localDateString } from '../utils/localDate';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeamJoinCode {
  id: number;
  teamId: number;
  code: string;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  createdAt: string;
}

export interface PositionOption {
  id: number;
  name: string;
}

export interface JoinCodeInfo {
  valid: boolean;
  reason?: 'expired' | 'inactive' | 'maxed' | 'notfound';
  teamId: number;
  teamName: string;
  sport: string;
  coachName: string;
  code: string;
  positions: PositionOption[];
}

export interface DietaryRestrictionInput {
  type: 'Allergy' | 'Lifestyle' | 'SoftPreference';
  category: string; // NutritionCategory name
  specificItem?: string;
  severity: 'Hard' | 'Lifestyle' | 'Soft';
}

export interface RegisterAthletePayload {
  code: string;
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string; // yyyy-MM-dd
  height: number; // cm
  weight: number; // kg
  positionId: number;
  jerseyNumber?: number | null;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  dietaryRestrictions: DietaryRestrictionInput[];
  preferences?: string;
}

export interface RegisterAthleteResult {
  user: { id: string; email: string; displayName: string; roles: string[] };
  teamName: string;
  playerId: number;
}

export interface AthleteInvite {
  id: number;
  email: string;
  createdAt: string;
  status: 'Pending' | 'Joined';
}

export interface AthleteInviteResult {
  email: string;
  joinUrl: string;
  emailSent: boolean;
}

// ── Public (no auth) ─────────────────────────────────────────────────────────

export const joinApi = {
  validateCode: async (code: string): Promise<JoinCodeInfo> => {
    const res = await api.get<JoinCodeInfo>(`/api/join-codes/validate/${encodeURIComponent(code)}`);
    return res.data;
  },

  // Creates the athlete account + player record. The caller follows up with a normal
  // login() so AuthContext/session handling stays on the single existing path.
  registerAthlete: async (payload: RegisterAthletePayload): Promise<RegisterAthleteResult> => {
    const res = await api.post<RegisterAthleteResult>('/api/auth/register-athlete', {
      ...payload,
      // §5d/S2.2: the client's local calendar date — the join date the auto-stint records.
      localDate: localDateString(),
    });
    return res.data;
  },

  // ── Coach (authenticated) ──────────────────────────────────────────────────

  getJoinCodes: async (teamId: number): Promise<TeamJoinCode[]> => {
    const res = await api.get<TeamJoinCode[]>(`/api/teams/${teamId}/join-codes`);
    return res.data;
  },

  generateJoinCode: async (teamId: number, opts?: { expiresInDays?: number; maxUses?: number }): Promise<TeamJoinCode> => {
    const res = await api.post<TeamJoinCode>(`/api/teams/${teamId}/join-code`, opts ?? {});
    return res.data;
  },

  deactivateJoinCode: async (joinCodeId: number): Promise<void> => {
    await api.delete(`/api/join-codes/${joinCodeId}`);
  },

  inviteAthlete: async (teamId: number, email: string): Promise<AthleteInviteResult> => {
    const res = await api.post<AthleteInviteResult>(`/api/teams/${teamId}/invite-athlete`, { email });
    return res.data;
  },

  getAthleteInvites: async (teamId: number): Promise<AthleteInvite[]> => {
    const res = await api.get<AthleteInvite[]>(`/api/teams/${teamId}/athlete-invites`);
    return res.data;
  },
};

// The public join URL athletes visit (also encoded in the QR).
export function joinUrlFor(code: string): string {
  return `${window.location.origin}/join/${code}`;
}
