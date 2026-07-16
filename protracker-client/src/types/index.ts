export type Role = 'Coach' | 'Athlete' | 'Parent' | 'SoloAthlete' | 'Admin';

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

export type CoachRoleType = 'HeadCoach' | 'AssistantCoach' | 'Analyst';

export interface CoachPermissions {
  canAssessPlayers: boolean;
  canAssignTasks: boolean;
  canViewPrivateNotes: boolean;
  canManagePlayers: boolean;
  canManageTeam: boolean;
}

export interface TeamCoach {
  id?: number | null; // TeamCoachRole id (null for the head coach)
  userId: string;
  name: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  role: CoachRoleType;
  isHeadCoach: boolean;
  isYou: boolean;
  permissions: CoachPermissions;
  acceptedAt?: string | null;
}

export interface InviteCoachInput {
  email: string;
  role: CoachRoleType;
  permissions: CoachPermissions;
}

export interface InviteCoachResult {
  email: string;
  inviteUrl: string;
}

export interface ValidateCoachInvite {
  valid: boolean;
  teamName?: string | null;
  sportName?: string | null;
  inviterName?: string | null;
  email?: string | null;
  role: CoachRoleType;
  emailHasAccount: boolean;
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
  drillId?: number | null;
  drillDifficulty?: DrillDifficulty | null;
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

// ─── Drill library (Phase C) ──────────────────────────────────────────────────
export type DrillCategory =
  | 'WarmUp' | 'Technical' | 'Tactical' | 'Fitness' | 'Strength'
  | 'Speed' | 'Agility' | 'Recovery' | 'Mental' | 'Cooldown';
export type DrillDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';

export interface DrillUsage {
  timesAssigned: number;
  timesCompleted: number;
  completionRate: number;
  playerCount: number;
}

export interface Drill {
  id: number;
  name: string;
  description?: string | null;
  sportIds: number[];
  sportNames: string[];
  category: DrillCategory;
  difficulty: DrillDifficulty;
  durationMinutes?: number | null;
  equipment?: string | null;
  instructions?: string | null;
  videoUrl?: string | null;
  targetStatCategories: string[];
  isBuiltIn: boolean;
  isCustom: boolean;
  isFavorited: boolean;
  createdAt: string;
  usage?: DrillUsage | null;
  // Populated only by recommendation responses (Section 3).
  recommendReason?: string | null;
  recommendTarget?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface DrillRecommendationItem {
  drill: Drill;
  reasoning: string;
  targetCategory?: string | null;
  priority: TaskPriority;
}

export interface DrillRecommendations {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  recommendations: DrillRecommendationItem[];
}

export interface DrillRank {
  drillId: number;
  name: string;
  assigned: number;
  completed: number;
  completionRate: number;
}

export interface DrillCategoryStat {
  category: DrillCategory;
  total: number;
  completed: number;
  completionRate: number;
}

export interface DrillPlayerStat {
  playerId: number;
  playerName: string;
  drillCount: number;
}

export interface DrillAnalytics {
  drillBasedTasks: number;
  manualTasks: number;
  totalDrillsAssigned: number;
  overallCompletionRate: number;
  mostAssigned: DrillRank[];
  mostCompleted: DrillRank[];
  byCategory: DrillCategoryStat[];
  byPlayer: DrillPlayerStat[];
}

// ─── Personal goals (Phase B) ─────────────────────────────────────────────────
export type GoalCategory = 'Performance' | 'Fitness' | 'Nutrition' | 'Mental' | 'Technical' | 'Tactical' | 'Other';
export type GoalStatus = 'Active' | 'Achieved' | 'Paused' | 'Abandoned';
export type GoalPriority = 'High' | 'Medium' | 'Low';
export type GoalProgressSource = 'Manual' | 'Assessment' | 'Match' | 'Auto';

export interface GoalMilestone {
  id: number;
  personalGoalId: number;
  title: string;
  targetValue?: number | null;
  isAchieved: boolean;
  achievedAt?: string | null;
  targetDate?: string | null;
}

export interface PersonalGoal {
  id: number;
  playerId: number;
  playerName: string;
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  linkedStatCategoryName?: string | null;
  startDate: string;
  targetDate?: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  isPrivate: boolean;
  createdAt: string;
  updatedAt?: string | null;
  achievedAt?: string | null;
  progressPercent?: number | null;
  milestones: GoalMilestone[];
}

export interface GoalProgress {
  id: number;
  personalGoalId: number;
  value: number;
  note?: string | null;
  recordedAt: string;
  source: GoalProgressSource;
}

export interface GoalSuggestion {
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  timelineWeeks?: number | null;
  focusArea?: string | null;
}

export interface GoalSuggestions {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  suggestions: GoalSuggestion[];
}

export interface CoachGoalOverviewRow {
  playerId: number;
  playerName: string;
  activeGoals: number;
  achievedGoals: number;
  avgProgress?: number | null;
}

export interface CoachGoalOverview {
  players: CoachGoalOverviewRow[];
  totalActiveGoals: number;
  playersWithGoals: number;
}

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

// ── Coach marketplace (Phase E) ──────────────────────────────────────────────
export interface CoachPublicProfileSettings {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  isPublic: boolean;
  teamCount: number;
  playerCount: number;
  averageTeamScore?: number | null;
}

export interface UpdateCoachPublicProfileInput {
  bio?: string | null;
  sportId?: number | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  isPublic: boolean;
}

export interface CoachMarketplaceItem {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  teamCount: number;
  playerCount: number;
  averageRating?: number | null;
  reviewCount: number;
}

export interface CoachReview {
  id: number;
  reviewerName: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  isVerified: boolean;
  coachResponse?: string | null;
  createdAt: string;
  isMine: boolean;
}

export interface CoachReviewsResponse {
  averageRating?: number | null;
  reviewCount: number;
  distribution: Record<string, number>;
  reviews: CoachReview[];
  hasReviewed: boolean;
  isOwner: boolean;
}

export interface SubmitCoachReviewInput {
  rating: number;
  title?: string | null;
  content?: string | null;
  sport?: number | null;
}

export interface ViewPoint {
  date: string;
  count: number;
}

export interface CompletenessItem {
  label: string;
  weight: number;
  done: boolean;
}

export interface CoachAnalytics {
  isPublic: boolean;
  totalViews: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  acceptanceRate: number;
  totalReviews: number;
  averageRating?: number | null;
  profileCompleteness: number;
  viewsBySource: Record<string, number>;
  viewsTrend: ViewPoint[];
  completenessItems: CompletenessItem[];
}

export interface CoachPublicProfileView {
  slug: string;
  displayName: string;
  profilePictureUrl?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  yearsCoaching?: number | null;
  certifications?: string | null;
  specialization?: string | null;
  isAcceptingAthletes: boolean;
  contactEmail?: string | null;
  teamCount: number;
  playerCount: number;
  averageTeamScore?: number | null;
  averageRating?: number | null;
  reviewCount: number;
}

export type ConnectionRequestStatus = 'Pending' | 'Accepted' | 'Declined' | 'Withdrawn';

// Coach's view of an incoming request.
export interface ConnectionRequest {
  id: number;
  coachUserId: string;
  coachName: string;
  athleteUserId: string;
  athleteName: string;
  athletePlayerId?: number | null;
  message?: string | null;
  sportId?: number | null;
  sportName?: string | null;
  status: ConnectionRequestStatus;
  coachNote?: string | null;
  resultJoinCode?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
}

// Athlete's view of a request they sent.
export interface MyConnectionRequest {
  id: number;
  coachName: string;
  coachSlug?: string | null;
  message?: string | null;
  sportName?: string | null;
  status: ConnectionRequestStatus;
  resultJoinCode?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
}

export interface SendConnectionRequestInput {
  message?: string | null;
  sport?: number | null;
}

export interface CoachMarketplaceQuery {
  sport?: number | null;
  city?: string;
  country?: string;
  accepting?: boolean;
  search?: string;
  minYears?: number | null;
  maxYears?: number | null;
  sort?: string;
  page?: number;
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

export interface SessionFeedback {
  id: number;
  scheduledSessionId: number;
  playerId: number;
  playerName: string;
  rating: number;
  energyBefore: number;
  energyAfter: number;
  difficulty: number;
  whatWentWell?: string | null;
  whatWasHard?: string | null;
  injuryNote?: string | null;
  submittedAt: string;
  sessionTitle?: string | null;
  sessionType?: SessionType | null;
  sessionStartTime?: string | null;
}

export interface SubmitSessionFeedbackInput {
  rating: number;
  energyBefore: number;
  energyAfter: number;
  difficulty: number;
  whatWentWell?: string | null;
  whatWasHard?: string | null;
  injuryNote?: string | null;
}

export interface SessionFeedbackSummary {
  scheduledSessionId: number;
  respondedCount: number;
  teamPlayerCount: number;
  averageRating?: number | null;
  averageDifficulty?: number | null;
  averageEnergyBefore?: number | null;
  averageEnergyAfter?: number | null;
  injuryFlagCount: number;
  responses: SessionFeedback[];
}

export interface MySessionFeedback {
  session: ScheduledSession;
  feedback?: SessionFeedback | null;
}

export interface RatedSessionPoint {
  scheduledSessionId: number;
  title: string;
  startTime: string;
  sessionType: SessionType;
  averageRating: number;
  averageDifficulty: number;
  respondedCount: number;
  injuryFlagCount: number;
}

export interface SessionTypeRating {
  sessionType: SessionType;
  averageRating: number;
  averageDifficulty: number;
  responseCount: number;
}

export interface SessionFeedbackAnalytics {
  totalResponses: number;
  overallAverageRating?: number | null;
  overallAverageDifficulty?: number | null;
  injuryFlagCount: number;
  ratingTrend: RatedSessionPoint[];
  byType: SessionTypeRating[];
}

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

// ── Leagues & tournaments (Phase F) ──────────────────────────────────────────
export type LeagueType = 'League' | 'Tournament' | 'Cup';
export type LeagueFormat = 'RoundRobin' | 'Knockout' | 'GroupStageKnockout' | 'Swiss';
export type LeagueStatus = 'Draft' | 'Registration' | 'Active' | 'Completed' | 'Cancelled';
export type LeagueTeamStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeagueMatchStatus = 'Scheduled' | 'Live' | 'Completed' | 'Postponed' | 'Cancelled';

export interface LeagueSummary {
  id: number;
  name: string;
  description?: string | null;
  sportId: number;
  sportName: string;
  organizerId: string;
  organizerName: string;
  type: LeagueType;
  format: LeagueFormat;
  status: LeagueStatus;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  teamCount: number;
  isPublic: boolean;
  location?: string | null;
  isOrganizer: boolean;
  isRegistered: boolean;
}

export interface LeagueTeamEntry {
  id: number;
  teamId: number;
  teamName: string;
  teamPhotoUrl?: string | null;
  coachId: string;
  coachName: string;
  status: LeagueTeamStatus;
  joinedAt: string;
  isMine: boolean;
}

export interface LeagueStanding {
  leagueTeamId: number;
  teamId: number;
  teamName: string;
  teamPhotoUrl?: string | null;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string | null;
  isMine: boolean;
}

export interface LeagueDetail extends LeagueSummary {
  rules?: string | null;
  prizeDescription?: string | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  scoreFormat: string; // Goals/Points/Sets/GamesAndSets
  teams: LeagueTeamEntry[];
  standings: LeagueStanding[];
}

export interface LeagueMatch {
  id: number;
  leagueId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamPhotoUrl?: string | null;
  awayTeamPhotoUrl?: string | null;
  scheduledAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  setScores?: string | null;
  status: LeagueMatchStatus;
  round?: number | null;
  group?: string | null;
  venue?: string | null;
  notes?: string | null;
}

export interface CreateLeagueInput {
  name: string;
  description?: string | null;
  sportId: number;
  type: LeagueType;
  format: LeagueFormat;
  startDate?: string | null;
  endDate?: string | null;
  maxTeams?: number | null;
  isPublic: boolean;
  location?: string | null;
  rules?: string | null;
  prizeDescription?: string | null;
}

export interface UpdateLeagueInput extends CreateLeagueInput {
  status: LeagueStatus;
}

export interface CreateLeagueMatchInput {
  homeTeamId: number;
  awayTeamId: number;
  scheduledAt?: string | null;
  round?: number | null;
  group?: string | null;
  venue?: string | null;
  notes?: string | null;
}

export interface UpdateLeagueMatchScoreInput {
  homeScore: number;
  awayScore: number;
  setScores?: string | null;
  status: LeagueMatchStatus;
}

export interface LeagueListQuery {
  sport?: number | null;
  status?: LeagueStatus;
  type?: LeagueType;
  search?: string;
}

// ── Notifications (persistent, DB-backed) ────────────────────────────────────
export type NotificationType =
  | 'General' | 'NewMessage' | 'NewTask' | 'TaskOverdue' | 'NewAnnouncement'
  | 'InjuryAlert' | 'SessionReminder' | 'ConnectionRequest' | 'ConnectionAccepted'
  | 'ConnectionDeclined' | 'AthleteJoined' | 'GoalAchieved' | 'AssessmentDue'
  | 'RecoveryMilestone' | 'RecoveryPlanReady' | 'ReviewReceived' | 'LeagueMatchScheduled';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  unreadCount: number;
}

// ── Evidence-based assessments (Phase G) ─────────────────────────────────────
export type MetricCategory = 'Physical' | 'Technical' | 'Tactical' | 'Mental' | 'Positional';
export type MetricInputType = 'Timer' | 'Weight' | 'Distance' | 'Percentage' | 'Count' | 'Rating' | 'Boolean';
export type EvidenceConfidence = 'Low' | 'Medium' | 'High' | 'VeryHigh';

export interface SportMetricDefinition {
  id: number;
  sportId: number;
  name: string;
  shortName: string | null;
  category: MetricCategory;
  description: string | null;
  unit: string | null;
  inputType: MetricInputType;
  objectiveTestWeight: number;
  matchStatWeight: number;
  coachEvalWeight: number;
  selfAssessWeight: number;
  isObjectiveRequired: boolean;
  benchmarkLow: number;
  benchmarkMid: number;
  benchmarkHigh: number;
  notes: string | null;
  sportStatCategoryId: number | null;
  supportsMatchStats: boolean;
  testSetup: string | null;
  testProcedure: string | null;
  commonMistakes: string | null;
  videoUrl: string | null;
}

export interface ObjectiveTestResult {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  value: number;
  unit: string;
  testedAt: string;
  testedBy: 'Coach' | 'Athlete' | 'ThirdParty';
  notes: string | null;
  assessmentId: number | null;
  normalizedScore: number;
}

export interface MatchStatEntry {
  id: number;
  playerId: number;
  matchResultId: number | null;
  statDate: string;
  sportId: number;
  stats: Record<string, number>;
  notes: string | null;
  isAutoImported: boolean;
}

export interface CoachEvaluationEntry {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  rating: number;
  evalDate: string;
  notes: string | null;
  assessmentId: number | null;
}

export interface SelfAssessmentEvidence {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  rating: number;
  evalDate: string;
  guidedAnswers: string | null;
  notes: string | null;
}

export interface EvidenceBasedScore {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  metricCategory: MetricCategory;
  sportStatCategoryId: number | null;
  assessmentId: number | null;
  finalScore: number;
  confidence: EvidenceConfidence;
  calculationMethod: 'Manual' | 'Calculated' | 'Hybrid';
  objectiveScore: number | null;
  matchStatScore: number | null;
  coachEvalScore: number | null;
  selfAssessScore: number | null;
  objectiveWeight: number;
  matchStatWeight: number;
  coachEvalWeight: number;
  selfAssessWeight: number;
  evidenceSources: string[];
  explanation: string | null;
  missingEvidence: string[];
  lastCalculatedAt: string;
  isObjectiveTestable: boolean;
  isObjectiveTestExpired: boolean;
  daysSinceObjectiveTest: number | null;
  nextObjectiveTestDue: string | null;
}

// Per-team batch payload: one roster player's current evidence scores.
export interface PlayerEvidenceScores {
  playerId: number;
  scores: EvidenceBasedScore[];
}

export interface EvidencePriority {
  metric: string;
  action: string;
  reason: string;
}

export interface EvidenceAnalysis {
  playerId: number;
  playerName: string;
  summary: string;
  priorities: EvidencePriority[];
  testBattery: string[];
  roadmap: string[];
  generatedAt: string;
}

export interface PlayerEvidenceStatus {
  playerId: number;
  playerName: string;
  jerseyNumber: number | null;
  scoredMetrics: number;
  verifiedMetrics: number;
  overallConfidence: EvidenceConfidence | null;
  lastTestAt: string | null;
  testCount: number;
  matchStatCount: number;
}

export interface TeamEvidenceStatus {
  teamId: number;
  totalMetrics: number;
  players: PlayerEvidenceStatus[];
  playersNeedingTests: number;
  playersWithoutMatchStats: number;
  playersWithoutEvidence: number;
}

// ── Team performance analytics (Phase G continuation, Section 6) ─────────────

export interface TeamMetricOutlier {
  playerId: number;
  playerName: string;
  score: number;
}

export interface TeamMetricPerformance {
  metricDefinitionId: number;
  name: string;
  category: string;
  unit: string | null;
  scoredCount: number;
  verifiedCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Sample (n-1) std dev; null when fewer than 4 players are scored. */
  stdDev: number | null;
  bandCounts: { red: number; amber: number; green: number };
  /** Players with blended FinalScore < 5 — the app scale's average, not a cohort benchmark. */
  belowAverageCount: number;
  lowOutliers: TeamMetricOutlier[];
  highOutliers: TeamMetricOutlier[];
}

export interface TeamEvidencePerformance {
  teamId: number;
  squadSize: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
  metrics: TeamMetricPerformance[];
}

export interface EvidenceReminder {
  type: 'NoRecentTest' | 'LowConfidence' | 'ExpiredTests';
  playerId: number | null;
  playerName: string | null;
  teamId: number | null;
  teamName: string | null;
  daysSinceTest: number | null;
  count: number | null;
}

// ── Benchmark calibration (Phase G accuracy round) ───────────────────────────
export type CompetitionLevel = 'Recreational' | 'Amateur' | 'SemiPro' | 'Professional';

export interface BenchmarkValue {
  metricDefinitionId: number;
  metricName: string;
  unit: string | null;
  inputType: string;
  benchmarkLow: number;
  benchmarkMid: number;
  benchmarkHigh: number;
  notes: string | null;
}

export interface BenchmarkProfile {
  id: number;
  sportId: number;
  name: string;
  ageGroupMin: number | null;
  ageGroupMax: number | null;
  competitionLevel: CompetitionLevel;
  isDefault: boolean;
  isMine: boolean;
  values: BenchmarkValue[];
}

export interface TeamBenchmarkProfile {
  teamId: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
}

export interface PlayerBenchmarks {
  playerId: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
  values: Record<number, BenchmarkValue>;
}
