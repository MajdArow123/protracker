import type { JournalMood } from './journal';

// ─── Public profile / progress sharing (Phase B) ──────────────────────────────
export interface PublicProfileSettings {
  slug: string;
  displayName: string;
  bio?: string | null;
  isPublic: boolean;
  showAssessments: boolean;
  showGoals: boolean;
  showJournal: boolean;
  showMatchHistory: boolean;
}

export interface PublicRadarPoint {
  category: string;
  value: number;
}

export interface PublicGoal {
  title: string;
  category: string;
  status: string;
  progressPercent?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
}

export interface PublicJournalEntry {
  entryDate: string;
  mood: JournalMood;
  title: string;
  excerpt: string;
}

export interface PublicMatch {
  matchDate: string;
  opponentName: string;
  result: 'Win' | 'Draw' | 'Loss';
  ourScore: number;
  opponentScore: number;
  rating?: number | null;
}

export interface PublicProfileView {
  slug: string;
  displayName: string;
  sport: string;
  position: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  assessmentCount: number;
  latestAvgScore?: number | null;
  showAssessments: boolean;
  showGoals: boolean;
  showJournal: boolean;
  showMatchHistory: boolean;
  skills: PublicRadarPoint[];
  goals: PublicGoal[];
  journal: PublicJournalEntry[];
  matches: PublicMatch[];
}
