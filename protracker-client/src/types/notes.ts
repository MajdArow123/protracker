export type CoachNoteCategory = 'General' | 'Performance' | 'Attitude' | 'Development' | 'Tactical' | 'Medical';

export interface CoachNote {
  id: number;
  playerId: number;
  coachId: string;
  coachName: string;
  content: string;
  category: CoachNoteCategory;
  isPrivate: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export type AthleteNoteCategory = 'Training' | 'Nutrition' | 'Mental' | 'Personal' | 'Goal' | 'Other';

export interface AthleteNote {
  id: number;
  title?: string | null;
  content: string;
  category: AthleteNoteCategory;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAthleteNoteInput {
  title?: string | null;
  content: string;
  category: AthleteNoteCategory;
}
