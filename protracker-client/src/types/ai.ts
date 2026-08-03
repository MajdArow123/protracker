export interface ImprovementPlan {
  id: number;
  playerId: number;
  createdDate: string;
  weeklyGoals?: string | null;
  trainingRecommendations?: string | null;
  skillTargets?: string | null;
  sportSpecificDrills?: string | null;
  positionFocus?: string | null;
  coachNotes?: string | null;
  isAIGenerated: boolean;
}
