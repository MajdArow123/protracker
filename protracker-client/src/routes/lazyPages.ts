import { lazy } from 'react';

// Helper: React.lazy expects a module with a `default` export, but our pages use
// named exports — this adapts a named export into the shape lazy() wants.
function named<T extends Record<string, unknown>, K extends keyof T>(
  factory: () => Promise<T>,
  key: K,
) {
  return lazy(() => factory().then((m) => ({ default: m[key] as React.ComponentType })));
}

// Pre-auth
export const LandingPage = named(() => import('../pages/LandingPage'), 'LandingPage');
export const LoginPage = named(() => import('../pages/auth/LoginPage'), 'LoginPage');
export const ForgotPasswordPage = named(() => import('../pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
export const RegisterPage = named(() => import('../pages/auth/RegisterPage'), 'RegisterPage');
export const JoinTeamPage = named(() => import('../pages/auth/JoinTeamPage'), 'JoinTeamPage');
export const CoachInviteAcceptPage = named(() => import('../pages/teams/CoachInviteAcceptPage'), 'CoachInviteAcceptPage');
export const SoloRegisterPage = named(() => import('../pages/auth/SoloRegisterPage'), 'SoloRegisterPage');
export const ResetPasswordPage = named(() => import('../pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
export const NotFoundPage = named(() => import('../pages/NotFoundPage'), 'NotFoundPage');

// Coach
export const CoachDashboardPage = named(() => import('../pages/dashboard/CoachDashboardPage'), 'CoachDashboardPage');
export const TeamsPage = named(() => import('../pages/teams/TeamsPage'), 'TeamsPage');
export const TeamDetailPage = named(() => import('../pages/teams/TeamDetailPage'), 'TeamDetailPage');
export const TeamFormPage = named(() => import('../pages/teams/TeamFormPage'), 'TeamFormPage');
export const PlayersPage = named(() => import('../pages/players/PlayersPage'), 'PlayersPage');
export const PlayerDetailPage = named(() => import('../pages/players/PlayerDetailPage'), 'PlayerDetailPage');
export const PlayerFormPage = named(() => import('../pages/players/PlayerFormPage'), 'PlayerFormPage');
export const AssessmentPage = named(() => import('../pages/assessments/AssessmentPage'), 'AssessmentPage');
export const BulkAssessmentPage = named(() => import('../pages/assessments/BulkAssessmentPage'), 'BulkAssessmentPage');
export const ImprovementPage = named(() => import('../pages/improvement/ImprovementPage'), 'ImprovementPage');
export const NutritionPage = named(() => import('../pages/nutrition/NutritionPage'), 'NutritionPage');
export const FoodAlternativesPage = named(() => import('../pages/nutrition/FoodAlternativesPage'), 'FoodAlternativesPage');
export const ReportsPage = named(() => import('../pages/reports/ReportsPage'), 'ReportsPage');
export const PlayerReportPage = named(() => import('../pages/reports/PlayerReportPage'), 'PlayerReportPage');
export const TeamReportPage = named(() => import('../pages/reports/TeamReportPage'), 'TeamReportPage');
export const ComparePlayersPage = named(() => import('../pages/reports/ComparePlayersPage'), 'ComparePlayersPage');
export const TasksPage = named(() => import('../pages/tasks/TasksPage'), 'TasksPage');
export const TaskAnalyticsPage = named(() => import('../pages/tasks/TaskAnalyticsPage'), 'TaskAnalyticsPage');
export const CoachProfilePage = named(() => import('../pages/profile/CoachProfilePage'), 'CoachProfilePage');
export const BillingPage = named(() => import('../pages/billing/BillingPage'), 'BillingPage');

// Athlete
export const PlayerDashboardPage = named(() => import('../pages/dashboard/PlayerDashboardPage'), 'PlayerDashboardPage');
export const PlayerStatsPage = named(() => import('../pages/dashboard/PlayerStatsPage'), 'PlayerStatsPage');
export const PlayerNutritionDashPage = named(() => import('../pages/dashboard/PlayerNutritionDashPage'), 'PlayerNutritionDashPage');
export const PlayerImprovementDashPage = named(() => import('../pages/dashboard/PlayerImprovementDashPage'), 'PlayerImprovementDashPage');
export const MyTasksPage = named(() => import('../pages/tasks/MyTasksPage'), 'MyTasksPage');
export const AthleteProfilePage = named(() => import('../pages/profile/AthleteProfilePage'), 'AthleteProfilePage');

// Solo athlete
export const SoloDashboardPage = named(() => import('../pages/dashboard/SoloDashboardPage'), 'SoloDashboardPage');
export const SoloAssessmentPage = named(() => import('../pages/solo/SoloAssessmentPage'), 'SoloAssessmentPage');
export const SoloNutritionPage = named(() => import('../pages/solo/SoloNutritionPage'), 'SoloNutritionPage');
export const SoloTrainingPage = named(() => import('../pages/solo/SoloTrainingPage'), 'SoloTrainingPage');
export const SoloMatchesPage = named(() => import('../pages/solo/SoloMatchesPage'), 'SoloMatchesPage');
export const SoloRecoveryPage = named(() => import('../pages/solo/SoloRecoveryPage'), 'SoloRecoveryPage');
export const SoloTasksPage = named(() => import('../pages/solo/SoloTasksPage'), 'SoloTasksPage');

// Parent portal
export const ParentInviteAcceptPage = named(() => import('../pages/parent/ParentInviteAcceptPage'), 'ParentInviteAcceptPage');
export const ParentDashboardPage = named(() => import('../pages/parent/ParentDashboardPage'), 'ParentDashboardPage');
export const ChildOverviewPage = named(() => import('../pages/parent/ChildOverviewPage'), 'ChildOverviewPage');

// Shared
export const MessagesPage = named(() => import('../pages/messages/MessagesPage'), 'MessagesPage');
export const NotificationsPage = named(() => import('../pages/notifications/NotificationsPage'), 'NotificationsPage');
// Personal goals (coach / athlete / solo — one shared page, role-aware).
export const GoalsPage = named(() => import('../pages/goals/GoalsPage'), 'GoalsPage');
// Progress journal (athlete / solo).
export const JournalPage = named(() => import('../pages/journal/JournalPage'), 'JournalPage');
export const AthleteNotesPage = named(() => import('../pages/notes/AthleteNotesPage'), 'AthleteNotesPage');
// Public shareable athlete profile (no auth).
export const PublicProfilePage = named(() => import('../pages/public/PublicProfilePage'), 'PublicProfilePage');
export const CoachPublicProfilePage = named(() => import('../pages/public/CoachPublicProfilePage'), 'CoachPublicProfilePage');
export const CoachMarketplacePage = named(() => import('../pages/public/CoachMarketplacePage'), 'CoachMarketplacePage');
export const ConnectionRequestsPage = named(() => import('../pages/coaches/ConnectionRequestsPage'), 'ConnectionRequestsPage');
export const ProfileAnalyticsPage = named(() => import('../pages/coaches/ProfileAnalyticsPage'), 'ProfileAnalyticsPage');
// Leagues & tournaments (Phase F).
export const LeaguesPage = named(() => import('../pages/leagues/LeaguesPage'), 'LeaguesPage');
export const LeagueDetailPage = named(() => import('../pages/leagues/LeagueDetailPage'), 'LeagueDetailPage');
// Drill & exercise library (coach / solo / team-athlete browse).
export const DrillLibraryPage = named(() => import('../pages/drills/DrillLibraryPage'), 'DrillLibraryPage');

// Warm the dashboard chunk the instant login succeeds, before the redirect fires.
export function preloadDashboard(role: 'Coach' | 'Athlete' | 'Parent' | 'SoloAthlete' | 'Admin') {
  if (role === 'Coach') import('../pages/dashboard/CoachDashboardPage');
  else if (role === 'Parent') import('../pages/parent/ParentDashboardPage');
  else if (role === 'SoloAthlete') import('../pages/dashboard/SoloDashboardPage');
  else import('../pages/dashboard/PlayerDashboardPage');
}
