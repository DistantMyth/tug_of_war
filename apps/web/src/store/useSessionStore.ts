import { create } from "zustand";
import type { PlayerRole, PlayerStatus, TeamId, YouView } from "@tow/shared";

const TOKEN_KEY = "tow_player_token";
const PLAYER_ID_KEY = "tow_player_id";
const PLAYER_LABEL_KEY = "tow_player_label";

interface SessionState {
  token: string | null;
  playerId: string | null;
  label: string | null;
  team: TeamId | null;
  chaos: boolean;
  role: PlayerRole | null;
  status: PlayerStatus;
  adminToken: string | null;
  displaySecret: string | null;

  setPlayerSession: (session: { token: string; playerId: string; label: string }) => void;
  updateFromYou: (you: YouView) => void;
  setAdminToken: (token: string | null) => void;
  setDisplaySecret: (secret: string | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,
  playerId: typeof window !== "undefined" ? localStorage.getItem(PLAYER_ID_KEY) : null,
  label: typeof window !== "undefined" ? localStorage.getItem(PLAYER_LABEL_KEY) : null,
  team: null,
  chaos: false,
  role: null,
  status: "online",
  adminToken: typeof window !== "undefined" ? localStorage.getItem("tow_admin_token") : null,
  displaySecret: typeof window !== "undefined" ? localStorage.getItem("tow_display_secret") : null,

  setPlayerSession: ({ token, playerId, label }) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(PLAYER_ID_KEY, playerId);
      localStorage.setItem(PLAYER_LABEL_KEY, label);
    }
    set({ token, playerId, label });
  },

  updateFromYou: (you: YouView) => {
    set({
      playerId: you.playerId,
      label: you.label,
      team: you.team,
      chaos: you.chaos,
      role: you.role,
      status: you.status,
    });
  },

  setAdminToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("tow_admin_token", token);
      else localStorage.removeItem("tow_admin_token");
    }
    set({ adminToken: token });
  },

  setDisplaySecret: (secret) => {
    if (typeof window !== "undefined") {
      if (secret) localStorage.setItem("tow_display_secret", secret);
      else localStorage.removeItem("tow_display_secret");
    }
    set({ displaySecret: secret });
  },

  clearSession: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PLAYER_ID_KEY);
      localStorage.removeItem(PLAYER_LABEL_KEY);
    }
    set({
      token: null,
      playerId: null,
      label: null,
      team: null,
      chaos: false,
      role: null,
    });
  },
}));
