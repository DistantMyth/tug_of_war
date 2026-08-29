import type { FinishReason, GamePhase, PlayerRole, PlayerStatus, TeamId, Winner } from "@tow/shared";

export interface SessionDocument {
  sessionId: string;
  status: "active" | "finished" | "abandoned";
  hostId?: string;
  createdAt: number;
  endedAt?: number;
  config: {
    roundDurationMs: number;
  };
}

export interface PlayerDocument {
  sessionId: string;
  playerId: string;
  displayLabel: string;
  finalTeam: TeamId | null;
  wasWildcard: boolean;
  role: PlayerRole | null;
  status: PlayerStatus;
  joinedAt: number;
  updatedAt: number;
}

export interface RoundCompositionPlayer {
  playerId: string;
  label: string;
  team: TeamId | "chaos";
}

export interface RoundExtensionEntry {
  seconds: number;
  timestamp: number;
}

export interface RoundDocument {
  sessionId: string;
  roundNumber: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  pauseAccumMs: number;
  extensions: RoundExtensionEntry[];
  teamLeftCount: number;
  teamRightCount: number;
  wildcardPlayerId: string | null;
  scoreLeft: number;
  scoreRight: number;
  winner: Winner;
  finishReason: FinishReason | "timer" | "host";
  composition: RoundCompositionPlayer[];
  createdAt: number;
}

export type AuditEventType =
  | "PHASE_CHANGE"
  | "BALANCE_PLAN"
  | "BALANCE_VOLUNTEER"
  | "BALANCE_AUTO"
  | "WILDCARD_SET"
  | "COUNTDOWN_START"
  | "ROUND_START"
  | "TIME_EXTEND"
  | "PAUSE"
  | "RESUME"
  | "ROUND_FINISH"
  | "REMATCH"
  | "EMERGENCY_STOP"
  | "PLAYER_ABANDONED";

export interface AuditEventDocument {
  sessionId: string;
  eventType: AuditEventType;
  data: Record<string, any>;
  timestamp: number;
}
