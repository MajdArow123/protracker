import type { Team } from './team';
import type { Player } from './player';
import type { PlayerAssessment } from './assessment';
import type { InjuryRecord } from './injury';
import type { MatchPerformance } from './match';

export interface PlayerAverageScore {
  playerId: number;
  playerName: string;
  averageScore: number;
}

export interface PlayerReport {
  player: Player & { sportName?: string; positionName?: string; teamName?: string };
  assessments: PlayerAssessment[];
  averageScoreByCategory: Record<string, number>;
  injuries: InjuryRecord[];
  recentMatches: MatchPerformance[];
}

export interface TeamReport {
  team: Team;
  // True only on season-filtered reports (Phase 10 S4): the player set is TODAY's
  // roster, not that season's actual squad — the UI must caveat it (S6 revisits).
  rosterIsCurrentNotHistorical?: boolean;
  playerCount: number;
  averageScoreByCategory: Record<string, number>;
  players: Player[];
  playerAverageScores: PlayerAverageScore[];
  activeInjuryCount: number;
  activeInjuries: InjuryRecord[];
}

export interface CoachDashboard {
  totalTeams: number;
  totalPlayers: number;
  teams: Team[];
}

export interface PlayerDashboard {
  player: Player;
  totalAssessments: number;
  latestAverageScore?: number | null;
  recentAssessments: PlayerAssessment[];
}
