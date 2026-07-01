import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { CoachDashboardPage } from './pages/dashboard/CoachDashboardPage';
import { PlayerDashboardPage } from './pages/dashboard/PlayerDashboardPage';
import { PlayerStatsPage } from './pages/dashboard/PlayerStatsPage';
import { PlayerNutritionDashPage } from './pages/dashboard/PlayerNutritionDashPage';
import { PlayerImprovementDashPage } from './pages/dashboard/PlayerImprovementDashPage';
import { TeamsPage } from './pages/teams/TeamsPage';
import { TeamDetailPage } from './pages/teams/TeamDetailPage';
import { TeamFormPage } from './pages/teams/TeamFormPage';
import { PlayersPage } from './pages/players/PlayersPage';
import { PlayerDetailPage } from './pages/players/PlayerDetailPage';
import { PlayerFormPage } from './pages/players/PlayerFormPage';
import { AssessmentPage } from './pages/assessments/AssessmentPage';
import { ImprovementPage } from './pages/improvement/ImprovementPage';
import { NutritionPage } from './pages/nutrition/NutritionPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { PlayerReportPage } from './pages/reports/PlayerReportPage';
import { TeamReportPage } from './pages/reports/TeamReportPage';
import { ComparePlayersPage } from './pages/reports/ComparePlayersPage';
import { FoodAlternativesPage } from './pages/nutrition/FoodAlternativesPage';
import { TasksPage } from './pages/tasks/TasksPage';
import { MyTasksPage } from './pages/tasks/MyTasksPage';
import { PageSpinner } from './components/ui/Spinner';
import { LandingPage } from './pages/LandingPage';
import { CoachProfilePage } from './pages/profile/CoachProfilePage';
import { AthleteProfilePage } from './pages/profile/AthleteProfilePage';

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
  return (
    <Navigate
      to={user.role === 'Coach' ? '/dashboard' : '/player-dashboard'}
      replace
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute roles={['Coach']} />}>
            <Route path="/dashboard" element={<CoachDashboardPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/new" element={<TeamFormPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/teams/:id/edit" element={<TeamFormPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/tasks" element={<TasksPage />} />
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
            <Route path="/player-dashboard/profile" element={<AthleteProfilePage />} />
            {/* Athlete can view their team in read-only mode */}
            <Route path="/player-dashboard/team/:id" element={<TeamDetailPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
              <ToastContainer />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
