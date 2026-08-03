export interface WellbeingCheckin {
  id: number;
  playerId: number;
  date: string;
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  painArea?: string | null;
  painNote?: string | null;
  notes?: string | null;
  score: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PlayerWellbeingTrend {
  playerId: number;
  playerName: string;
  checkins: WellbeingCheckin[];
  avgFeeling?: number | null;
  avgEnergy?: number | null;
  avgSleep?: number | null;
  avgScore?: number | null;
  painDays: number;
}

export interface TeamWellbeingPlayer {
  playerId: number;
  playerName: string;
  teamName: string;
  latestCheckin?: WellbeingCheckin | null;
  checkedInToday: boolean;
  painDuringRecovery: boolean;
}

export interface TeamWellbeingSummary {
  players: TeamWellbeingPlayer[];
  totalPlayers: number;
  checkedInToday: number;
  avgScoreToday?: number | null;
  painAlerts: number;
}
