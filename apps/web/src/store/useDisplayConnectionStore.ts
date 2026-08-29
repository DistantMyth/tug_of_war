import { create } from "zustand";

export type DisplayConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

interface DisplayConnectionState {
  status: DisplayConnectionStatus;
  lastError: string | null;
  socketId: string | null;

  setStatus: (status: DisplayConnectionStatus) => void;
  setLastError: (error: string | null) => void;
  setSocketId: (id: string | null) => void;
}

export const useDisplayConnectionStore = create<DisplayConnectionState>((set) => ({
  status: "idle",
  lastError: null,
  socketId: null,

  setStatus: (status) => set({ status }),
  setLastError: (lastError) => set({ lastError }),
  setSocketId: (socketId) => set({ socketId }),
}));
