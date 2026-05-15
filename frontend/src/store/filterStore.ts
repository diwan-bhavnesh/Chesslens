import { create } from "zustand";

interface FilterState {
  platform: string;
  result:   string;
  gameType: string;
  dateKey:  string;
  setPlatform: (v: string) => void;
  setResult:   (v: string) => void;
  setGameType: (v: string) => void;
  setDateKey:  (v: string) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  platform: "all",
  result:   "all",
  gameType: "all",
  dateKey:  "all",
  setPlatform: (platform) => set({ platform }),
  setResult:   (result)   => set({ result }),
  setGameType: (gameType) => set({ gameType }),
  setDateKey:  (dateKey)  => set({ dateKey }),
  clearFilters: () => set({ platform: "all", result: "all", gameType: "all", dateKey: "all" }),
}));
