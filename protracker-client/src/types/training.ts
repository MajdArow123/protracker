export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface TrainingSession {
  id: number;
  playerId: number;
  teamId: number;
  date: string;
  durationMinutes: number;
  notes?: string | null;
  attendanceStatus: AttendanceStatus;
}

export type SessionType = 'Training' | 'MatchPrep' | 'Recovery' | 'Strength' | 'Tactical' | 'Other';

export interface SessionFeedback {
  id: number;
  scheduledSessionId: number;
  playerId: number;
  playerName: string;
  rating: number;
  energyBefore: number;
  energyAfter: number;
  difficulty: number;
  whatWentWell?: string | null;
  whatWasHard?: string | null;
  injuryNote?: string | null;
  submittedAt: string;
  sessionTitle?: string | null;
  sessionType?: SessionType | null;
  sessionStartTime?: string | null;
}

export interface SubmitSessionFeedbackInput {
  rating: number;
  energyBefore: number;
  energyAfter: number;
  difficulty: number;
  whatWentWell?: string | null;
  whatWasHard?: string | null;
  injuryNote?: string | null;
}

export interface SessionFeedbackSummary {
  scheduledSessionId: number;
  respondedCount: number;
  teamPlayerCount: number;
  averageRating?: number | null;
  averageDifficulty?: number | null;
  averageEnergyBefore?: number | null;
  averageEnergyAfter?: number | null;
  injuryFlagCount: number;
  responses: SessionFeedback[];
}

export interface MySessionFeedback {
  session: ScheduledSession;
  feedback?: SessionFeedback | null;
}

export interface RatedSessionPoint {
  scheduledSessionId: number;
  title: string;
  startTime: string;
  sessionType: SessionType;
  averageRating: number;
  averageDifficulty: number;
  respondedCount: number;
  injuryFlagCount: number;
}

export interface SessionTypeRating {
  sessionType: SessionType;
  averageRating: number;
  averageDifficulty: number;
  responseCount: number;
}

export interface SessionFeedbackAnalytics {
  totalResponses: number;
  overallAverageRating?: number | null;
  overallAverageDifficulty?: number | null;
  injuryFlagCount: number;
  ratingTrend: RatedSessionPoint[];
  byType: SessionTypeRating[];
}

export interface ScheduledSession {
  id: number;
  teamId: number;
  teamName: string;
  title: string;
  sessionType: SessionType;
  startTime: string;
  durationMinutes: number;
  location?: string | null;
  focus?: string | null;
  notes?: string | null;
}
