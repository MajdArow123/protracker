export type Role = 'Coach' | 'Athlete' | 'Parent' | 'SoloAthlete';

export interface User {
  id: string;       // UUID from auth
  email: string;
  fullName: string; // mapped from API's displayName
  role: Role;       // mapped from API's roles[0]
}

// --- Billing ---
export type BillingPlanName = 'Free' | 'Pro' | 'Team';

export interface BillingLimits {
  maxTeams: number | null;
  maxPlayers: number | null;
  ai: boolean;
  pdf: boolean;
  parentPortal: boolean;
  prioritySupport: boolean;
}

export interface BillingInfo {
  plan: BillingPlanName;
  status?: string | null;
  currentPeriodEnd?: string | null;
  limits: BillingLimits;
  usage: { teams: number; players: number };
  stripeEnabled: boolean;
  publishableKey?: string | null;
  hasStripeCustomer: boolean;
}

// --- Parent portal ---
export interface ParentChild {
  playerId: number;
  fullName: string;
  teamName?: string | null;
  sportName?: string | null;
  positionName?: string | null;
  age?: number | null;
  fitnessLevel?: number | null;
  overallAverage?: number | null;
  activeInjuryCount: number;
}

export interface ChildInjury {
  injuryType: string;
  bodyPart?: string | null;
  severity: string;
  recoveryStatus: string;
  injuryDate: string;
  expectedReturnDate?: string | null;
}

export interface ChildSession {
  title: string;
  sessionType: string;
  startTime: string;
  durationMinutes: number;
  location?: string | null;
}

export interface ChildTask {
  title: string;
  category: string;
  priority: string;
  dueDate?: string | null;
  isCompleted: boolean;
}

export interface ChildWellbeingPoint {
  date: string;
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  score: number;
}

export interface ChildOverview {
  playerId: number;
  fullName: string;
  teamName?: string | null;
  sportName?: string | null;
  positionName?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  fitnessLevel?: number | null;
  averageScoreByCategory: Record<string, number>;
  overallAverage?: number | null;
  lastAssessmentDate?: string | null;
  injuries: ChildInjury[];
  upcomingSessions: ChildSession[];
  tasks: ChildTask[];
  wellbeing: ChildWellbeingPoint[];
  wellbeingScore?: number | null;
}

export interface ParentInviteInfo {
  valid: boolean;
  email: string;
  parentName: string;
  playerName: string;
  coachName: string;
  accountExists: boolean;
}

export interface ParentInviteResult {
  email: string;
  parentName: string;
  inviteUrl: string;
  emailSent: boolean;
}

export interface PlayerParent {
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface Sport {
  id: number;
  name: string;
  description: string;
  iconOrImage?: string | null;
}

export interface Position {
  id: number;
  name: string;
  sportId: number;
}

export interface StatCategory {
  id: number;
  name: string;
  description: string;
  sportId: number;
  minValue: number;
  maxValue: number;
}

export interface Team {
  id: number;
  name: string;
  sportId: number;
  sportName: string;
  coachId: string;   // UUID
  playerCount?: number;
  photoUrl?: string | null;
  foundedYear?: number | null;
  description?: string | null;
}

export type PlayerStatus = 'Active' | 'Injured' | 'Suspended' | 'Inactive';

export interface Player {
  id: number;
  userId?: string;   // UUID — only on detail endpoint
  fullName: string;
  age?: number;
  height?: number;
  weight?: number;
  sportId: number;
  teamId?: number;
  teamName?: string;
  positionId?: number;
  positionName?: string;
  fitnessLevel?: number;
  profileImageUrl?: string | null;
  jerseyNumber?: number | null;
  status?: PlayerStatus;
  // Set only for athletes who self-enrolled via a team join code.
  joinedViaCodeAt?: string | null;
  // detail-only fields
  injuryNotes?: string | null;
  goals?: string | null;
  coachNotes?: string | null;
}

export interface PlayerStatScore {
  id: number;
  playerAssessmentId: number;
  sportStatCategoryId: number;
  statCategoryName: string;
  score: number;
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

export interface NutritionProfileItem {
  id: number;
  playerId: number;
  preferenceType: string;
  category: string;
  specificItem?: string | null;
  severity: string;
  notes?: string | null;
}

export interface NutritionGuidance {
  id: number;
  playerId: number;
  createdDate: string;
  goal?: string | null;
  mealSuggestions?: string | null;
  hydrationTips?: string | null;
  recoveryTips?: string | null;
  foodsToPrioritize?: string | null;
  foodsToLimit?: string | null;
  disclaimer: string;
  isAIGenerated: boolean;
  mealPlanJson?: string | null;
}

export interface MealItem {
  food: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Meal {
  name: string;
  time: string;
  items: MealItem[];
}

export interface StructuredMealPlan {
  goal: string;
  dailyCalories: number;
  macros: { protein: number; carbs: number; fats: number; fiber: number };
  hydrationMl: number;
  meals: Meal[];
  mealSuggestions?: string;
  hydrationTips?: string;
  recoveryTips?: string;
  foodsToPrioritize?: string;
  foodsToLimit?: string;
}

// ── Weekly Nutrition Plan types ──────────────────────────────────────────────

export interface PlannedMealItem {
  id: number;
  plannedMealId: number;
  foodName: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  isSwapped: boolean;
  originalFoodName?: string | null;
}

export interface PlannedMeal {
  id: number;
  dailyMealPlanId: number;
  mealType: string;
  time: string;
  plannedMealItems: PlannedMealItem[];
}

export interface DailyMealPlan {
  id: number;
  weeklyNutritionPlanId: number;
  dayNumber: number;
  dayName: string;
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFats: number;
  plannedMeals: PlannedMeal[];
}

export interface WeeklyNutritionPlan {
  id: number;
  playerId: number;
  createdDate: string;
  weekStartDate: string;
  isAIGenerated: boolean;
  dailyMealPlans: DailyMealPlan[];
}

export interface SwapMealItemRequest {
  newFoodName: string;
  newPortion: string;
  newCalories: number;
  newProtein: number;
  newCarbs: number;
  newFats: number;
}

// ────────────────────────────────────────────────────────────────────────────

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
  teamId: number;
  teamName: string;
  name: string;
  startDate: string;
  endDate: string;
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

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Tactical' | 'Physical' | 'Other';

export interface TaskSuggestion {
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  focusArea?: string | null;
  rationale?: string | null;
}

export interface TaskSuggestions {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  suggestions: TaskSuggestion[];
  generatedAt: string;
}

export interface PlayerTaskStats {
  playerId: number;
  playerName: string;
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

export interface TaskCategoryStats {
  category: TaskCategory;
  total: number;
  completed: number;
  completionRate: number;
}

export interface WeeklyTaskTrend {
  weekStart: string;
  weekLabel: string;
  assigned: number;
  completed: number;
}

export interface TaskAnalytics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  avgDaysToComplete?: number | null;
  playerStats: PlayerTaskStats[];
  categoryStats: TaskCategoryStats[];
  weeklyTrend: WeeklyTaskTrend[];
  topPerformer?: PlayerTaskStats | null;
  needsAttention?: PlayerTaskStats | null;
}

export interface PlayerTask {
  id: number;
  coachId: string;
  playerId: number;
  playerName: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  isCompleted: boolean;
  completedAt?: string | null;
  completedNote?: string | null;
  createdAt: string;
}

export type InjurySeverity = 'Minor' | 'Moderate' | 'Severe';
export type RecoveryStatus = 'Active' | 'Recovering' | 'FullyRecovered';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

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

export type MatchOutcome = 'Win' | 'Draw' | 'Loss';
export type ScoreFormat = 'Goals' | 'Points' | 'Sets' | 'GamesAndSets';

export interface PlayerMatchRating {
  id: number;
  matchResultId: number;
  playerId: number;
  playerName: string;
  rating: number;
  statJson?: string | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  notes?: string | null;
  matchDate?: string | null;
  opponentName?: string | null;
  scoreFormat?: ScoreFormat | null;
}

export interface MatchResult {
  id: number;
  teamId: number;
  teamName: string;
  opponentName: string;
  matchDate: string;
  homeScore: number;
  awayScore: number;
  isHome: boolean;
  ourScore: number;
  opponentScore: number;
  result: MatchOutcome;
  scoreFormat: ScoreFormat;
  setScores?: string | null;
  scoreDisplay: string;
  venue?: string | null;
  competition?: string | null;
  notes?: string | null;
  ratings: PlayerMatchRating[];
}

export interface MatchPerformance {
  id: number;
  playerId: number;
  matchDate: string;
  opponent: string;
  performanceRating: number;
  notes?: string | null;
  sportSpecificStats?: string | null;
}

export interface TrainingSession {
  id: number;
  playerId: number;
  teamId: number;
  date: string;
  durationMinutes: number;
  notes?: string | null;
  attendanceStatus: AttendanceStatus;
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

export interface Message {
  id: number;
  senderId: string;
  receiverId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  readAt?: string | null;
  isMine: boolean;
}

export interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  unreadCount: number;
}

export interface MessageContact {
  userId: string;
  name: string;
  role: string;
}

export type AnnouncementPriority = 'Normal' | 'Important' | 'Urgent';

export interface TeamAnnouncement {
  id: number;
  teamId: number;
  teamName: string;
  coachId: string;
  coachName: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

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

export type SessionType = 'Training' | 'MatchPrep' | 'Recovery' | 'Strength' | 'Tactical' | 'Other';

export interface ScheduledSession {
  id: number;
  teamId: number;
  teamName: string;
  title: string;
  sessionType: SessionType;
  startTime: string;
  durationMinutes: number;
  location?: string | null;
  focus?: string | null;
  notes?: string | null;
}

export interface FoodAlternative {
  id: number;
  originalFood: string;
  alternativeFood: string;
  proteinMatchScore: number;
  carbMatchScore: number;
  fatMatchScore: number;
  calorieMatchScore: number;
  recoveryValue: number;
  sportPerformanceNote?: string | null;
  reasonExplanation?: string | null;
  suggestedPortion?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
}

// A food scaled to a portion matching the meal item being swapped (see /api/food-alternatives/equivalent).
export interface EquivalentFood {
  id: number;
  foodName: string;
  category: string;
  suggestedPortion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  isGoodMatch: boolean;
  matchQuality: 'good' | 'similar' | 'different';
  originalCalories: number;
  caloriesDiffPct: number;
}

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

export interface WellbeingCheckin {
  id: number;
  playerId: number;
  date: string;
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  painArea?: string | null;
  painNote?: string | null;
  notes?: string | null;
  score: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PlayerWellbeingTrend {
  playerId: number;
  playerName: string;
  checkins: WellbeingCheckin[];
  avgFeeling?: number | null;
  avgEnergy?: number | null;
  avgSleep?: number | null;
  avgScore?: number | null;
  painDays: number;
}

export interface TeamWellbeingPlayer {
  playerId: number;
  playerName: string;
  teamName: string;
  latestCheckin?: WellbeingCheckin | null;
  checkedInToday: boolean;
  painDuringRecovery: boolean;
}

export interface TeamWellbeingSummary {
  players: TeamWellbeingPlayer[];
  totalPlayers: number;
  checkedInToday: number;
  avgScoreToday?: number | null;
  painAlerts: number;
}
