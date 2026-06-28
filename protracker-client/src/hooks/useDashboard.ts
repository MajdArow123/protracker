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

/** Finds the current athlete's integer player ID by matching their auth UUID against player profiles. */
export function useMyPlayerId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myPlayerId', user?.id],
    queryFn: async () => {
      const players = await playersApi.getPlayers();
      for (const p of players) {
        const detail = await playersApi.getPlayer(p.id);
        if (detail.userId === user?.id) return p.id;
      }
      return null;
    },
    enabled: !!user && user.role === 'Athlete',
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
