export interface PlayerStatScore {
  id: number;
  playerAssessmentId: number;
  sportStatCategoryId: number;
  statCategoryName: string;
  score: number;
}

// ─── Assessment templates (Phase D) ──────────────────────────────────────────
export interface AssessmentTemplateScore {
  sportStatCategoryId: number;
  categoryName: string;
  defaultScore?: number | null;
  weight?: number | null;
  isRequired: boolean;
}

export interface AssessmentTemplate {
  id: number;
  coachId: string;
  name: string;
  description?: string | null;
  sportId: number;
  sportName: string;
  defaultNotes?: string | null;
  createdAt: string;
  scores: AssessmentTemplateScore[];
}

export interface AppliedTemplate {
  templateId: number;
  templateName: string;
  playerId: number;
  defaultNotes?: string | null;
  scores: AssessmentTemplateScore[];
}

export interface PlayerAssessment {
  id: number;
  seasonNotice?: SeasonResolutionNotice | null;
  playerId: number;
  assessmentPeriodId: number;
  assessmentPeriodName: string;
  dateRecorded: string;
  notes?: string | null;
  statScores: PlayerStatScore[];
}

export interface AssessmentPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  teamId: number;
  seasonId?: number | null;
}

// Phase 10 S3/S3+: attached to a create or update response when season resolution was
// Ambiguous ("AmbiguousSeason", candidates listed) or when a date-changing update moved
// a previously stamped record outside all seasons ("SeasonUnstamped"). The record saved
// fine (seasonId null on it); non-blocking nudge. Absent/null on reads and clean
// resolutions.
export interface SeasonResolutionNotice {
  code: string; // "AmbiguousSeason" | "SeasonUnstamped"
  candidateSeasonIds: number[];
}

export type SeasonStatus = 'Draft' | 'Active' | 'Completed' | 'Archived';

export interface SeasonTeamRef {
  id: number;
  name: string;
}

// Account-owned; can span several teams (S5 removed the single-team wire shim).
// Overlapping Active seasons are allowed.
export interface Season {
  id: number;
  teams: SeasonTeamRef[];
  name: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
  goals?: string | null;
  linkedPeriodCount: number;
}

export interface CreateSeasonInput {
  name: string;
  startDate: string;
  endDate: string;
  // Omitted = Draft on create / unchanged on update. Full lifecycle reachable since S5
  // (the old isActive shim could only produce Active/Draft).
  status?: SeasonStatus;
  goals?: string | null;
}

// Rows currently STAMPED to a season (row-level seasonId — the S3/S4 mechanism, NOT the
// period-linkage summary). Powers the edit-dates warning.
export interface SeasonStampedCounts {
  seasonId: number;
  matches: number;
  assessments: number;
  objectiveTests: number;
  evidenceScores: number;
  matchPerformances: number;
  lineups: number;
  trainingSessions: number;
  scheduledSessions: number;
  improvementPlans: number;
  total: number;
}

// Phase 10 S6: one roster stint — a player's membership window on a team within a
// season. Multiple non-overlapping stints per (player, season) are legal (mid-season
// transfers, leave-and-rejoin); overlap within one season is a server-side 400.
export interface SeasonRosterStint {
  id: number;
  seasonId: number;
  teamId: number;
  teamName: string;
  playerId: number;
  playerName: string;
  jerseyNumber?: number | null;
  positionId?: number | null;
  positionName?: string | null;
  joinedAt: string;
  leftAt?: string | null;
}

export interface SaveSeasonRosterStintInput {
  playerId: number;
  teamId: number;
  // Required by ruling (an undated stint resolves nothing); the UI defaults it to the
  // season's start date, editable.
  joinedAt: string;
  leftAt?: string | null;
  jerseyNumber?: number | null;
  positionId?: number | null;
}

// Save response (S6 ruling): saving a stint NEVER retroactively assigns existing
// records — unstampedInWindow is the count of the player's unassigned records inside
// the stint's effective window, surfaced so the UI can point at S7 backfill tooling.
export interface SeasonRosterSaveResult {
  stint: SeasonRosterStint;
  unstampedInWindow: number;
}

export interface SeasonPeriodPoint {
  periodId: number;
  periodName: string;
  startDate: string;
  average: number;
  isLinked: boolean;
}

export interface SeasonCategoryTrend {
  category: string;
  startAverage: number;
  endAverage: number;
  improvement: number;
}

export interface SeasonSummary {
  seasonId: number;
  name: string;
  startDate: string;
  endDate: string;
  hasData: boolean;
  startPeriodName?: string | null;
  endPeriodName?: string | null;
  startAverage: number;
  endAverage: number;
  improvement: number;
  categoryTrends: SeasonCategoryTrend[];
  points: SeasonPeriodPoint[];
}

// Phase 10 S7: backfill preview/result. Preview and execute share the shape — for
// preview the numbers are "would", for execute they are what actually happened. Gap
// (no covering season) and ambiguous (overlap) counts are first-class answers the UI
// must render as prominently as the assigned counts.
export interface SeasonBackfillSeasonCount {
  seasonId: number;
  seasonName: string;
  count: number;
}

export interface SeasonBackfillEntity {
  entityType: string;
  totalCandidates: number;
  bySeason: SeasonBackfillSeasonCount[];
  stamped: number;
  gap: number;
  ambiguous: number;
}

export interface SeasonBackfillPreview {
  entities: SeasonBackfillEntity[];
  totalCandidates: number;
  totalStamped: number;
  totalGap: number;
  totalAmbiguous: number;
}

export interface SeasonBackfillResult extends SeasonBackfillPreview {
  runId: number;
  ranAt: string;
}
