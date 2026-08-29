import type { ErrorCode, GamePhase, Winner } from "@tow/shared";

export type GameState = {
  gameId: string;
  phase: GamePhase;
  roundNumber: number;
  durationMs: number;
  startTime: number | null;
  endTime: number | null;
  pausedAt: number | null;
  pauseAccumMs: number;
  leftScore: number;
  rightScore: number;
  totalPlayers: number;
  leftCount: number;
  rightCount: number;
  wildcardPlayerId: string | null;
  winner: Winner | null;
};

export type GameCommand =
  | { type: "OPEN_GAME"; durationMs?: number }
  | {
      type: "LOCK_GAME";
      totalPlayers: number;
      leftCount: number;
      rightCount: number;
      wildcardPlayerId: string | null;
    }
  | { type: "RESOLVE_LOCK" }
  | { type: "CANCEL_BALANCING" }
  | { type: "COMPLETE_BALANCE" }
  | { type: "START_COUNTDOWN" }
  | { type: "START_RUNNING"; now: number }
  | { type: "PAUSE_GAME"; now: number }
  | { type: "RESUME_GAME"; now: number }
  | { type: "END_ROUND" }
  | { type: "FINISH_RESULTS" }
  | { type: "PLAY_AGAIN" }
  | { type: "SHUFFLE_AND_PLAY"; balancingRequired: boolean }
  | { type: "END_EVENT" }
  | { type: "EMERGENCY_STOP" };

export type PhaseChangedEvent = {
  type: "PHASE_CHANGED";
  from: GamePhase;
  to: GamePhase;
};

export type GameResetEvent = {
  type: "GAME_RESET";
  reason: "emergency" | "end_event";
};

export type GameEvent = PhaseChangedEvent | GameResetEvent;

export type TransitionError = {
  code: ErrorCode;
  message: string;
};

export type GameTransitionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: TransitionError };
