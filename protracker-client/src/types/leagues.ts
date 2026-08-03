// ── Leagues & tournaments (Phase F) ──────────────────────────────────────────
export type LeagueType = 'League' | 'Tournament' | 'Cup';
export type LeagueFormat = 'RoundRobin' | 'Knockout' | 'GroupStageKnockout' | 'Swiss';
export type LeagueStatus = 'Draft' | 'Registration' | 'Active' | 'Completed' | 'Cancelled';
export type LeagueTeamStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeagueMatchStatus = 'Scheduled' | 'Live' | 'Completed' | 'Postponed' | 'Cancelled';

export interface LeagueSummary {
  id: number;
  name: string;
  description?: string | null;
  sportId: number;
  sportName: string;
  organizerId: string;
  organizerName: string;
  type: LeagueType;
  format: LeagueFormat;
  status: LeagueStatus;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  teamCount: number;
  isPublic: boolean;
  location?: string | null;
  isOrganizer: boolean;
  isRegistered: boolean;
}

export interface LeagueTeamEntry {
  id: number;
  teamId: number;
  teamName: string;
  teamPhotoUrl?: string | null;
  coachId: string;
  coachName: string;
  status: LeagueTeamStatus;
  joinedAt: string;
  isMine: boolean;
}

export interface LeagueStanding {
  leagueTeamId: number;
  teamId: number;
  teamName: string;
  teamPhotoUrl?: string | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string | null;
  isMine: boolean;
}

export interface LeagueDetail extends LeagueSummary {
  rules?: string | null;
  prizeDescription?: string | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  scoreFormat: string; // Goals/Points/Sets/GamesAndSets
  teams: LeagueTeamEntry[];
  standings: LeagueStanding[];
}

export interface LeagueMatch {
  id: number;
  leagueId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamPhotoUrl?: string | null;
  awayTeamPhotoUrl?: string | null;
  scheduledAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  setScores?: string | null;
  status: LeagueMatchStatus;
  round?: number | null;
  group?: string | null;
  venue?: string | null;
  notes?: string | null;
}

export interface CreateLeagueInput {
  name: string;
  description?: string | null;
  sportId: number;
  type: LeagueType;
  format: LeagueFormat;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  isPublic: boolean;
  location?: string | null;
  rules?: string | null;
  prizeDescription?: string | null;
}

export interface UpdateLeagueInput extends CreateLeagueInput {
  status: LeagueStatus;
}

export interface CreateLeagueMatchInput {
  homeTeamId: number;
  awayTeamId: number;
  scheduledAt?: string | null;
  round?: number | null;
  group?: string | null;
  venue?: string | null;
  notes?: string | null;
}

export interface UpdateLeagueMatchScoreInput {
  homeScore: number;
  awayScore: number;
  setScores?: string | null;
  status: LeagueMatchStatus;
}

export interface LeagueListQuery {
  sport?: number | null;
  status?: LeagueStatus;
  type?: LeagueType;
  search?: string;
}
