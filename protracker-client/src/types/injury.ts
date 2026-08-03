export type InjurySeverity = 'Minor' | 'Moderate' | 'Severe';
export type RecoveryStatus = 'Active' | 'Recovering' | 'FullyRecovered';

export interface InjuryRecord {
  id: number;
  playerId: number;
  playerName?: string;
  injuryDate: string;
  injuryType: string;
  bodyPart?: string | null;
  severity: InjurySeverity;
  recoveryStatus: RecoveryStatus;
  isRecovered?: boolean;
  notes?: string | null;
  treatmentPlan?: string | null;
  expectedReturnDate?: string | null;
  recoveredDate?: string | null;
}

export type RecoveryPlanStatus = 'Active' | 'Completed' | 'Paused';
export type RecoveryExerciseCategory = 'Mobility' | 'Strength' | 'Cardio' | 'Flexibility' | 'Balance' | 'Ice' | 'Heat' | 'Rest';

export interface RecoveryExercise {
  id: number;
  injuryRecoveryPlanId: number;
  title: string;
  description?: string | null;
  sets?: number | null;
  reps?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  week: number;
  dayOfWeek: string;
  category: RecoveryExerciseCategory;
  isCompleted: boolean;
  completedAt?: string | null;
  completedNote?: string | null;
  difficultyRating?: number | null;
}

export interface RecoveryMilestone {
  id: number;
  injuryRecoveryPlanId: number;
  title: string;
  targetWeek: number;
  isAchieved: boolean;
  achievedAt?: string | null;
  notes?: string | null;
}

export interface RecoveryPlan {
  id: number;
  injuryRecordId: number;
  playerId: number;
  playerName: string;
  coachId: string;
  title: string;
  estimatedWeeks: number;
  currentWeek: number;
  status: RecoveryPlanStatus;
  notes?: string | null;
  createdAt: string;
  injuryType: string;
  bodyPart?: string | null;
  severity: InjurySeverity;
  completedExercises: number;
  totalExercises: number;
  exercises: RecoveryExercise[];
  milestones: RecoveryMilestone[];
}

export interface RecoveryTemplateExercise {
  title: string;
  description?: string | null;
  sets?: number | null;
  reps?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  week: number;
  dayOfWeek: string;
  category: RecoveryExerciseCategory;
}

export interface RecoveryTemplateMilestone {
  title: string;
  targetWeek: number;
}

export interface RecoveryTemplate {
  id: number;
  name: string;
  bodyPart: string;
  description?: string | null;
  estimatedWeeks: number;
  typicalSeverity: InjurySeverity;
  exerciseCount: number;
  milestoneCount: number;
  exercises: RecoveryTemplateExercise[];
  milestones: RecoveryTemplateMilestone[];
}
