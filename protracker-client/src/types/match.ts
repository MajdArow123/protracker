import type { SeasonResolutionNotice } from './assessment';

export type MatchOutcome = 'Win' | 'Draw' | 'Loss';
export type ScoreFormat = 'Goals' | 'Points' | 'Sets' | 'GamesAndSets';

export interface PlayerMatchRating {
  id: number;
  matchResultId: number;
  playerId: number;
  playerName: string;
  rating: number;
  statJson?: string | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  notes?: string | null;
  matchDate?: string | null;
  opponentName?: string | null;
  scoreFormat?: ScoreFormat | null;
}

// Scheduled = an upcoming fixture: it has NO score, and every score/outcome
// field below is null — the API masks them so a future match can never render
// as a 0-0 Draw (Phase 7a fixtures honesty gate).
export type MatchStatus = 'Played' | 'Scheduled';

export interface MatchResult {
  id: number;
  seasonNotice?: SeasonResolutionNotice | null;
  teamId: number;
  teamName: string;
  opponentName: string;
  matchDate: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  isHome: boolean;
  ourScore: number | null;
  opponentScore: number | null;
  result: MatchOutcome | null;
  scoreFormat: ScoreFormat;
  setScores?: string | null;
  scoreDisplay: string | null;
  venue?: string | null;
  competition?: string | null;
  notes?: string | null;
  // Coach-entered opponent plan — render with the coach-entered SourceBadge,
  // never as recorded fact.
  opponentFormation?: string | null;
  scoutingNotes?: string | null;
  ratings: PlayerMatchRating[];
}

export interface MatchPerformance {
  id: number;
  seasonNotice?: SeasonResolutionNotice | null;
  playerId: number;
  matchDate: string;
  opponent: string;
  performanceRating: number;
  notes?: string | null;
  sportSpecificStats?: string | null;
}
