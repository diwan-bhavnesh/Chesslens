import { create } from "zustand";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  /** Set when startup could not confirm the session for a reason that is NOT "logged out" (offline, server down). */
  authError: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setAuthError: (message: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  authError: null,
  setUser: (user) => set({ user, authError: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setAuthError: (authError) => set({ authError }),
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null });
  },
}));
