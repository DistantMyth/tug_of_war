import { create } from "zustand";
import type { PlayerRole, PlayerStatus, TeamId, YouView } from "@tow/shared";
import { safeGetStorage, safeRemoveStorage, safeSetStorage } from "../utils/storage.js";

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
  token: safeGetStorage(TOKEN_KEY),
  playerId: safeGetStorage(PLAYER_ID_KEY),
  label: safeGetStorage(PLAYER_LABEL_KEY),
  team: null,
  chaos: false,
  role: null,
  status: "online",
  adminToken: safeGetStorage("tow_admin_token"),
  displaySecret: safeGetStorage("tow_display_secret"),

  setPlayerSession: ({ token, playerId, label }) => {
    safeSetStorage(TOKEN_KEY, token);
    safeSetStorage(PLAYER_ID_KEY, playerId);
    safeSetStorage(PLAYER_LABEL_KEY, label);
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
    if (token) safeSetStorage("tow_admin_token", token);
    else safeRemoveStorage("tow_admin_token");
    set({ adminToken: token });
  },

  setDisplaySecret: (secret) => {
    if (secret) safeSetStorage("tow_display_secret", secret);
    else safeRemoveStorage("tow_display_secret");
    set({ displaySecret: secret });
  },

  clearSession: () => {
    safeRemoveStorage(TOKEN_KEY);
    safeRemoveStorage(PLAYER_ID_KEY);
    safeRemoveStorage(PLAYER_LABEL_KEY);
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
