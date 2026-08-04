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

export interface Season {
  id: number;
  // One participating team (the queried team when known) — seasons are account-owned
  // and can span several teams (SeasonTeam rows on the backend).
  teamId: number;
  teamName: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  // Derived on the backend: status === 'Active'. Overlapping active seasons are allowed.
  isActive: boolean;
  goals?: string | null;
  linkedPeriodCount: number;
}

export interface CreateSeasonInput {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  goals?: string | null;
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
