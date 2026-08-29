import { create } from "zustand";

export interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  durationMs?: number;
}

interface UiState {
  soundEnabled: boolean;
  toasts: ToastMessage[];
  lastTapFeedbackAt: number;

  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  triggerTapFeedback: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  soundEnabled: typeof window !== "undefined" ? localStorage.getItem("tow_sound_enabled") !== "false" : true,
  toasts: [],
  lastTapFeedbackAt: 0,

  setSoundEnabled: (soundEnabled) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tow_sound_enabled", String(soundEnabled));
    }
    set({ soundEnabled });
  },

  toggleSound: () =>
    set((state) => {
      const next = !state.soundEnabled;
      if (typeof window !== "undefined") {
        localStorage.setItem("tow_sound_enabled", String(next));
      }
      return { soundEnabled: next };
    }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.durationMs ?? 4000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  triggerTapFeedback: () => set({ lastTapFeedbackAt: Date.now() }),
}));
