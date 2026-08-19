import api from './axiosInstance';
import type { Player } from '../types';
import { localDateString } from '../utils/localDate';

export const playersApi = {
  getPlayers: async (): Promise<Player[]> => {
    const res = await api.get<Player[]>('/api/players');
    return res.data;
  },
  getMyPlayer: async (): Promise<Player> => {
    const res = await api.get<Player>('/api/players/me');
    return res.data;
  },
  getPlayer: async (id: number): Promise<Player> => {
    const res = await api.get<Player>(`/api/players/${id}`);
    return res.data;
  },
  createPlayer: async (data: Partial<Player>): Promise<Player> => {
    // §5d/S2.2: the client's local calendar date — the join date the auto-stint records.
    const res = await api.post<Player>('/api/players', { ...data, localDate: localDateString() });
    return res.data;
  },
  updatePlayer: async (id: number, data: Partial<Player>): Promise<Player> => {
    const res = await api.put<Player>(`/api/players/${id}`, data);
    return res.data;
  },
  deletePlayer: async (id: number): Promise<void> => {
    await api.delete(`/api/players/${id}`);
  },
};
