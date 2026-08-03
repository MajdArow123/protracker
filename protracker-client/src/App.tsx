import { Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ChatRealtimeProvider } from './context/ChatRealtimeContext';
import { ToastContainer } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PageSpinner } from './components/ui/Spinner';
import { PageLoadingSkeleton } from './components/ui/PageLoadingSkeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { RouteProgressBar } from './components/ui/RouteProgressBar';
import {
  LandingPage, LoginPage, ForgotPasswordPage, ResetPasswordPage, NotFoundPage,
  RegisterPage, JoinTeamPage, CoachInviteAcceptPage, SoloRegisterPage, SoloDashboardPage,
  SoloAssessmentPage, SoloNutritionPage, SoloTrainingPage, SoloMatchesPage,
  SoloRecoveryPage, SoloTasksPage,
  CoachDashboardPage, TeamsPage, TeamDetailPage, TeamFormPage,
  PlayersPage, PlayerDetailPage, PlayerFormPage,
  AssessmentPage, BulkAssessmentPage, ImprovementPage, NutritionPage, FoodAlternativesPage,
  ReportsPage, PlayerReportPage, TeamReportPage, ComparePlayersPage,
  TasksPage, TaskAnalyticsPage, CoachProfilePage, BillingPage,
  PlayerDashboardPage, PlayerStatsPage, PlayerNutritionDashPage,
  PlayerImprovementDashPage, MyTasksPage, AthleteProfilePage,
  MessagesPage,
  NotificationsPage,
  ParentInviteAcceptPage, ParentDashboardPage, ChildOverviewPage,
  GoalsPage, JournalPage, AthleteNotesPage, PublicProfilePage, CoachPublicProfilePage,
  CoachMarketplacePage, ConnectionRequestsPage, ProfileAnalyticsPage, DrillLibraryPage,
  LeaguesPage, LeagueDetailPage,
} from './routes/lazyPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSpinner />;
  if (!user) return <LandingPage />;
  const home = user.role === 'Coach' ? '/dashboard' : user.role === 'Parent' ? '/parent-dashboard' : user.role === 'SoloAthlete' ? '/solo-dashboard' : '/player-dashboard';
  return <Navigate to={home} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/parent-invite" element={<ParentInviteAcceptPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/solo" element={<SoloRegisterPage />} />
      <Route path="/join/:code" element={<JoinTeamPage />} />
      <Route path="/coach-invite/:token" element={<CoachInviteAcceptPage />} />
      {/* Public shareable athlete profile — no auth required. */}
      <Route path="/player/:slug" element={<PublicProfilePage />} />
      <Route path="/coaches" element={<CoachMarketplacePage />} />
      <Route path="/coaches/:slug" element={<CoachPublicProfilePage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Messaging is available to both roles */}
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          {/* Leagues are viewable by all roles (coach manages, athlete read-only) */}
          <Route path="/leagues" element={<LeaguesPage />} />
          <Route path="/leagues/:id" element={<LeagueDetailPage />} />
          <Route element={<ProtectedRoute roles={['Coach']} />}>
            <Route path="/dashboard" element={<CoachDashboardPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/new" element={<TeamFormPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/teams/:id/edit" element={<TeamFormPage />} />
            <Route path="/teams/:id/bulk-assessment" element={<BulkAssessmentPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/drills" element={<DrillLibraryPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/analytics" element={<TaskAnalyticsPage />} />
            <Route path="/coach/connection-requests" element={<ConnectionRequestsPage />} />
            <Route path="/coach/profile-analytics" element={<ProfileAnalyticsPage />} />
            <Route path="/players/new" element={<PlayerFormPage />} />
            <Route path="/players/:id" element={<PlayerDetailPage />} />
            <Route path="/players/:id/edit" element={<PlayerFormPage />} />
            <Route
              path="/players/:id/assessment"
              element={<AssessmentPage />}
            />
            <Route
              path="/players/:id/improvement-plan"
              element={<ImprovementPage />}
            />
            <Route
              path="/players/:id/nutrition"
              element={<NutritionPage />}
            />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/player/:id" element={<PlayerReportPage />} />
            <Route path="/reports/team/:id" element={<TeamReportPage />} />
            <Route path="/reports/compare" element={<ComparePlayersPage />} />
            <Route path="/nutrition/food-alternatives" element={<FoodAlternativesPage />} />
            <Route path="/profile" element={<CoachProfilePage />} />
            <Route path="/settings/billing" element={<BillingPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['Athlete']} />}>
            <Route
              path="/player-dashboard"
              element={<PlayerDashboardPage />}
            />
            <Route
              path="/player-dashboard/stats"
              element={<PlayerStatsPage />}
            />
            <Route
              path="/player-dashboard/nutrition"
              element={<PlayerNutritionDashPage />}
            />
            <Route
              path="/player-dashboard/improvement"
              element={<PlayerImprovementDashPage />}
            />
            <Route path="/player-dashboard/tasks" element={<MyTasksPage />} />
            <Route path="/player-dashboard/goals" element={<GoalsPage />} />
            <Route path="/player-dashboard/journal" element={<JournalPage />} />
            <Route path="/player-dashboard/notes" element={<AthleteNotesPage />} />
            <Route path="/player-dashboard/drills" element={<DrillLibraryPage />} />
            <Route path="/player-dashboard/profile" element={<AthleteProfilePage />} />
            {/* Athlete can view their team in read-only mode */}
            <Route path="/player-dashboard/team/:id" element={<TeamDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['SoloAthlete']} />}>
            <Route path="/solo-dashboard" element={<SoloDashboardPage />} />
            <Route path="/solo/goals" element={<GoalsPage />} />
            <Route path="/solo/journal" element={<JournalPage />} />
            <Route path="/solo/notes" element={<AthleteNotesPage />} />
            <Route path="/solo/drills" element={<DrillLibraryPage />} />
            <Route path="/solo/tasks" element={<SoloTasksPage />} />
            <Route path="/solo/profile" element={<AthleteProfilePage />} />
            {/* My Performance reuses the athlete stats/history page (player-scoped, role-agnostic). */}
            <Route path="/solo/performance" element={<PlayerStatsPage />} />
            <Route path="/solo/assessment" element={<SoloAssessmentPage />} />
            <Route path="/solo/nutrition" element={<SoloNutritionPage />} />
            <Route path="/solo/training" element={<SoloTrainingPage />} />
            <Route path="/solo/matches" element={<SoloMatchesPage />} />
            <Route path="/solo/recovery" element={<SoloRecoveryPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['Parent']} />}>
            <Route path="/parent-dashboard" element={<ParentDashboardPage />} />
            <Route path="/parent-dashboard/child/:id" element={<ChildOverviewPage />} />
          </Route>
        </Route>
      </Route>
      {/* Catch-all — standalone 404 for any unmatched path. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* reducedMotion="user": every framer-motion animation app-wide honors the
          OS prefers-reduced-motion setting (transform/layout animations are
          skipped; opacity still animates per framer's a11y model). */}
      <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ChatRealtimeProvider>
                <BrowserRouter>
                  <ScrollToTop />
                  <RouteProgressBar />
                  <OfflineBanner />
                  <AppRoutes />
                  <ToastContainer />
                </BrowserRouter>
              </ChatRealtimeProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
