import { create } from "zustand";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  isReconnecting: boolean;
  socketId: string | null;
  lastError: string | null;
  ping: number;

  setStatus: (status: ConnectionStatus) => void;
  setSocketId: (id: string | null) => void;
  setLastError: (error: string | null) => void;
  setIsReconnecting: (reconnecting: boolean) => void;
  setPing: (ping: number) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  isReconnecting: false,
  socketId: null,
  lastError: null,
  ping: 0,

  setStatus: (status) => set({ status, isReconnecting: status === "connecting" }),
  setSocketId: (socketId) => set({ socketId }),
  setLastError: (lastError) => set({ lastError }),
  setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
  setPing: (ping) => set({ ping }),
}));
