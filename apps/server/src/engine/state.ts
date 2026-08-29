import { DEFAULT_ROUND_DURATION_MS } from "@tow/shared";
import type { GameState } from "./types.js";

export function createInitialGameState(gameId: string, durationMs = DEFAULT_ROUND_DURATION_MS): GameState {
  return {
    gameId,
    phase: "WAITING",
    roundNumber: 0,
    durationMs,
    startTime: null,
    endTime: null,
    pausedAt: null,
    pauseAccumMs: 0,
    leftScore: 0,
    rightScore: 0,
    totalPlayers: 0,
    leftCount: 0,
    rightCount: 0,
    wildcardPlayerId: null,
    winner: null,
  };
}

export function cloneGameState(state: GameState): GameState {
  return { ...state };
}

export function resetRoundClock(state: GameState): Pick<
  GameState,
  "startTime" | "endTime" | "pausedAt" | "pauseAccumMs" | "leftScore" | "rightScore" | "winner"
> {
  return {
    startTime: null,
    endTime: null,
    pausedAt: null,
    pauseAccumMs: 0,
    leftScore: 0,
    rightScore: 0,
    winner: null,
  };
}

export function waitingReset(state: GameState): GameState {
  return {
    ...createInitialGameState(state.gameId, state.durationMs),
  };
}
