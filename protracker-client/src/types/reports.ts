import type { Team } from './team';
import type { Player } from './player';
import type { PlayerAssessment } from './assessment';
import type { InjuryRecord } from './injury';
import type { MatchPerformance } from './match';
import type { SeasonRosterStint } from './assessment';

export interface PlayerAverageScore {
  playerId: number;
  playerName: string;
  averageScore: number;
  // §5h: stamped-record counts, present only on season-filtered reports.
  assessmentCount?: number | null;
  objectiveTestCount?: number | null;
  matchPerformanceCount?: number | null;
}

export interface PlayerReport {
  player: Player & { sportName?: string; positionName?: string; teamName?: string };
  assessments: PlayerAssessment[];
  averageScoreByCategory: Record<string, number>;
  injuries: InjuryRecord[];
  recentMatches: MatchPerformance[];
}

// §5h: stamped team-context counts for the filtered season.
export interface SeasonRecordCounts {
  matches: number;
  trainingSessions: number;
  scheduledSessions: number;
}

export interface TeamReport {
  team: Team;
  playerCount: number;
  averageScoreByCategory: Record<string, number>;
  players: Player[];
  playerAverageScores: PlayerAverageScore[];
  activeInjuryCount: number;
  activeInjuries: InjuryRecord[];
  // §5h — present ONLY on season-filtered reports (the filtered report is now
  // genuinely historical: stint roster + stamps; the old
  // rosterIsCurrentNotHistorical caveat flag is gone).
  seasonRecords?: SeasonRecordCounts | null;
  seasonRoster?: SeasonRosterStint[] | null;
  unassignedCount?: number | null;
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
