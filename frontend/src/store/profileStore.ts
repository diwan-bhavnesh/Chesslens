import { create } from "zustand";
import type { PlayerProfile } from "../types";
import { api } from "../services/api";

interface ProfileState {
  profile: PlayerProfile | null;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  pollProfile: () => Promise<void>;
  createProfile: () => Promise<void>;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: false,

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<PlayerProfile>("/profile/me");
      set({ profile: data });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        set({ profile: null });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  pollProfile: async () => {
    try {
      const { data } = await api.get<PlayerProfile>("/profile/me");
      set({ profile: data });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        set({ profile: null });
      }
    }
  },

  createProfile: async () => {
    try {
      const { data } = await api.post<PlayerProfile>("/profile/create");
      set({ profile: data });
    } catch (err: any) {
      if (err?.response?.status !== 409) throw err;
    }
  },

  clearProfile: () => set({ profile: null }),
}));
