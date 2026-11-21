import { create } from "zustand";

export type ToastKind = "error" | "success" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, kind = "error") => {
    // Same message already on screen (e.g. a poll failing every 3s) → don't stack duplicates.
    if (get().toasts.some(t => t.message === message && t.kind === kind)) return;
    const id = nextId++;
    set(state => ({ toasts: [...state.toasts, { id, kind, message }].slice(-MAX_VISIBLE) }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

/** Call from anywhere (stores, handlers) without needing a hook. */
export const toast = {
  error: (message: string) => useToastStore.getState().show(message, "error"),
  success: (message: string) => useToastStore.getState().show(message, "success"),
  info: (message: string) => useToastStore.getState().show(message, "info"),
};
