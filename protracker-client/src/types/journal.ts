// ─── Progress journal (Phase B) ───────────────────────────────────────────────
export type JournalMood = 'Great' | 'Good' | 'Okay' | 'Tough' | 'Rough';

export interface JournalEntry {
  id: number;
  playerId: number;
  entryDate: string;
  title?: string | null;
  content: string;
  mood: JournalMood;
  energyLevel: number;
  trainingRating?: number | null;
  keyLearning?: string | null;
  tomorrowFocus?: string | null;
  tags?: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt?: string | null;
}
