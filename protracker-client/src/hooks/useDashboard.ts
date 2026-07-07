import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';
import { playersApi } from '../api/playersApi';
import { useAuth } from '../context/AuthContext';

export function useCoachDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'coach'],
    queryFn: dashboardApi.getCoachDashboard,
    staleTime: 60_000,
  });
}

/** Resolves the current athlete's player ID via GET /api/players/me (single request, no 403 risk). */
export function useMyPlayerId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myPlayerId', user?.id],
    queryFn: async () => {
      const player = await playersApi.getMyPlayer();
      return player.id;
    },
    enabled: !!user && (user.role === 'Athlete' || user.role === 'SoloAthlete'),
    staleTime: Infinity,
  });
}

export function usePlayerDashboard(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'player', playerId],
    queryFn: () => dashboardApi.getPlayerDashboard(playerId!),
    enabled: !!playerId,
    staleTime: 60_000,
  });
}
