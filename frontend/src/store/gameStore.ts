import { create } from "zustand";
import type { BatchAnalysis, Game, GameDetail } from "../types";
import { api } from "../services/api";
import { getErrorMessage, getErrorStatus } from "../utils/errors";

interface GameState {
  gamesError: string | null;                 // set when the games list fails to load
  gameLoadError: "not_found" | "failed" | null; // set when the single game fails on first load
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
  gamesError: null,
  gameLoadError: null,
  games: [],
  currentGame: null,
  batchAnalysis: null,
  isLoading: false,

  fetchGames: async () => {
    set({ isLoading: true, gamesError: null });
    try {
      const { data } = await api.get<Game[]>("/games/?limit=5000");
      set({ games: data });
    } catch (err) {
      // Keep any games we already have; pages show a retry state only when the list is empty.
      set({ gamesError: getErrorMessage(err, "We couldn't load your games.") });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchGame: async (id) => {
    const isInitialLoad = get().currentGame?.id !== id;
    if (isInitialLoad) set({ currentGame: null, gameLoadError: null });
    try {
      const { data } = await api.get<GameDetail>(`/games/${id}`);
      set({ currentGame: data, gameLoadError: null });
    } catch (err) {
      // On a background poll failure keep the last good data rather than blanking the screen.
      if (isInitialLoad) {
        set({ gameLoadError: getErrorStatus(err) === 404 ? "not_found" : "failed" });
      }
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
