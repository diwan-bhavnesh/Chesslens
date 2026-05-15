import { create } from "zustand";
import type { BatchAnalysis, Game, GameDetail } from "../types";
import { api } from "../services/api";

interface GameState {
  games: Game[];
  currentGame: GameDetail | null;
  batchAnalysis: BatchAnalysis | null;
  isLoading: boolean;        // used by Dashboard (fetchGames)
  fetchGames: () => Promise<void>;
  fetchGame: (id: string) => Promise<void>;
  refreshGameInList: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  clearAllGames: () => Promise<void>;
  triggerAnalysis: (id: string) => Promise<void>;
  triggerBatchAnalysis: () => Promise<void>;
  fetchBatchAnalysis: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  currentGame: null,
  batchAnalysis: null,
  isLoading: false,

  fetchGames: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<Game[]>("/games/?limit=200");
      set({ games: data });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchGame: async (id) => {
    try {
      const { data } = await api.get<GameDetail>(`/games/${id}`);
      set({ currentGame: data });
    } catch {
      // on initial load currentGame is already null → "Game not found" shows
      // on poll failure keep the last good data rather than blanking the screen
    }
  },

  refreshGameInList: async (id) => {
    try {
      const { data } = await api.get<GameDetail>(`/games/${id}`);
      set(state => ({
        games: state.games.map(g => g.id === id ? { ...g, analysis: data.analysis } : g),
      }));
    } catch {
      // keep existing row data on failure
    }
  },

  deleteGame: async (id) => {
    await api.delete(`/games/${id}`);
    set({ games: get().games.filter((g) => g.id !== id) });
  },

  clearAllGames: async () => {
    await api.delete("/games/all");
    set({ games: [], batchAnalysis: null });
  },

  triggerAnalysis: async (id) => {
    await api.post(`/analysis/${id}`);
  },

  triggerBatchAnalysis: async () => {
    const { data } = await api.post<BatchAnalysis>("/analysis/batch");
    set({ batchAnalysis: data });
  },

  fetchBatchAnalysis: async () => {
    try {
      const { data } = await api.get<BatchAnalysis>("/analysis/batch/latest");
      set({ batchAnalysis: data });
    } catch {
      // 404 means no batch analysis yet — fine
    }
  },
}));
