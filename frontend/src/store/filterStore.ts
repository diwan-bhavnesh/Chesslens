import { create } from "zustand";

interface FilterState {
  result:   string;   // "all" | "win" | "loss" | "draw"
  gameType: string;   // "all" | "bullet" | "blitz" | "rapid" | "classical" | "chess960"
  dateKey:  string;   // "all" | "7d" | "30d" | "3m" | "6m" | "1y"
  sortBy:   "date" | "accuracy" | "result";
  sortDir:  "asc" | "desc";
  setResult:   (v: string) => void;
  setGameType: (v: string) => void;
  setDateKey:  (v: string) => void;
  setSortBy:   (v: "date" | "accuracy" | "result") => void;
  setSortDir:  (v: "asc" | "desc") => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  result:   "all",
  gameType: "all",
  dateKey:  "all",
  sortBy:   "date",
  sortDir:  "desc",
  setResult:   (result)   => set({ result }),
  setGameType: (gameType) => set({ gameType }),
  setDateKey:  (dateKey)  => set({ dateKey }),
  setSortBy:   (sortBy)   => set({ sortBy }),
  setSortDir:  (sortDir)  => set({ sortDir }),
  clearFilters: () => set({ result: "all", gameType: "all", dateKey: "all", sortBy: "date", sortDir: "desc" }),
}));
