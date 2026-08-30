import type { GamePhase, Winner } from "@tow/shared";
import { invalidTransition } from "./errors.js";
import { canTransition } from "./machine.js";
import { isRosterReadyForCountdown } from "./roster.js";
import { cloneGameState, createInitialGameState, resetRoundClock, waitingReset } from "./state.js";
import type { GameCommand, GameEvent, GameState, GameTransitionResult } from "./types.js";

function succeed(
  from: GameState,
  to: GamePhase,
  patch: Partial<GameState>,
  extraEvents: GameEvent[] = [],
  emergency = false,
): GameTransitionResult {
  if (!canTransition(from.phase, to, emergency)) {
    return invalidTransition(from.phase, to);
  }

  const events: GameEvent[] = [];
  if (from.phase !== to) {
    events.push({ type: "PHASE_CHANGED", from: from.phase, to });
  }
  events.push(...extraEvents);

  return {
    ok: true,
    state: {
      ...cloneGameState(from),
      ...patch,
      phase: to,
    },
    events,
  };
}

function winnerFromScores(leftScore: number, rightScore: number): Winner {
  if (leftScore > rightScore) {
    return "left";
  }
  if (rightScore > leftScore) {
    return "right";
  }
  return "draw";
}

function nextRoundNumber(state: GameState): number {
  return state.roundNumber + 1;
}

function openGame(state: GameState, command: Extract<GameCommand, { type: "OPEN_GAME" }>): GameTransitionResult {
  return succeed(state, "OPEN", {
    durationMs: command.durationMs ?? state.durationMs,
    roundNumber: state.roundNumber === 0 ? 1 : state.roundNumber,
  });
}

function lockGame(state: GameState, command: Extract<GameCommand, { type: "LOCK_GAME" }>): GameTransitionResult {
  return succeed(state, "LOCKING", {
    totalPlayers: command.totalPlayers,
    leftCount: command.leftCount,
    rightCount: command.rightCount,
    wildcardPlayerId: command.wildcardPlayerId,
  });
}

function resolveLock(state: GameState): GameTransitionResult {
  if (state.phase !== "LOCKING") {
    const to: GamePhase = isRosterReadyForCountdown(state) ? "COUNTDOWN" : "BALANCING";
    return invalidTransition(state.phase, to);
  }
  const to: GamePhase = isRosterReadyForCountdown(state) ? "COUNTDOWN" : "BALANCING";
  return succeed(state, to, {});
}

function cancelBalancing(state: GameState): GameTransitionResult {
  return succeed(state, "OPEN", {});
}

function completeBalance(state: GameState): GameTransitionResult {
  if (state.phase !== "BALANCING" || !isRosterReadyForCountdown(state)) {
    return invalidTransition(state.phase, "COUNTDOWN");
  }
  return succeed(state, "COUNTDOWN", {});
}

function startCountdown(state: GameState): GameTransitionResult {
  if (state.phase !== "LOCKING" && state.phase !== "BALANCING") {
    return invalidTransition(state.phase, "COUNTDOWN");
  }
  if (!isRosterReadyForCountdown(state)) {
    return invalidTransition(state.phase, "COUNTDOWN");
  }
  return succeed(state, "COUNTDOWN", {});
}

function startRunning(state: GameState, command: Extract<GameCommand, { type: "START_RUNNING" }>): GameTransitionResult {
  return succeed(state, "RUNNING", {
    startTime: command.now,
    endTime: command.now + state.durationMs,
    pausedAt: null,
    pauseAccumMs: 0,
  });
}

function pauseGame(state: GameState, command: Extract<GameCommand, { type: "PAUSE_GAME" }>): GameTransitionResult {
  return succeed(state, "PAUSED", {
    pausedAt: command.now,
  });
}

function resumeGame(state: GameState, command: Extract<GameCommand, { type: "RESUME_GAME" }>): GameTransitionResult {
  const pausedAt = state.pausedAt ?? command.now;
  const delta = command.now - pausedAt;
  return succeed(state, "RUNNING", {
    pausedAt: null,
    pauseAccumMs: state.pauseAccumMs + Math.max(0, delta),
    endTime: (state.endTime ?? command.now) + Math.max(0, delta),
  });
}

function endRound(state: GameState): GameTransitionResult {
  return succeed(state, "FINISHED", {
    winner: winnerFromScores(state.leftScore, state.rightScore),
  });
}

function finishResults(state: GameState): GameTransitionResult {
  return succeed(state, "RESULTS", {});
}

function playAgain(state: GameState): GameTransitionResult {
  return succeed(state, "COUNTDOWN", {
    roundNumber: nextRoundNumber(state),
    ...resetRoundClock(state),
  });
}

function shuffleAndPlay(
  state: GameState,
  command: Extract<GameCommand, { type: "SHUFFLE_AND_PLAY" }>,
): GameTransitionResult {
  const to: GamePhase = command.balancingRequired ? "BALANCING" : "COUNTDOWN";
  return succeed(state, to, {
    roundNumber: nextRoundNumber(state),
    ...resetRoundClock(state),
  });
}

function endEvent(state: GameState): GameTransitionResult {
  return succeed(
    state,
    "WAITING",
    waitingReset(state),
    [{ type: "GAME_RESET", reason: "end_event" }],
    true,
  );
}

function emergencyStop(state: GameState): GameTransitionResult {
  return succeed(
    state,
    "WAITING",
    waitingReset(state),
    [{ type: "GAME_RESET", reason: "emergency" }],
    true,
  );
}

export function reduceGame(state: GameState, command: GameCommand): GameTransitionResult {
  switch (command.type) {
    case "OPEN_GAME":
      return openGame(state, command);
    case "LOCK_GAME":
      return lockGame(state, command);
    case "RESOLVE_LOCK":
      return resolveLock(state);
    case "CANCEL_BALANCING":
      return cancelBalancing(state);
    case "COMPLETE_BALANCE":
      return completeBalance(state);
    case "START_COUNTDOWN":
      return startCountdown(state);
    case "START_RUNNING":
      return startRunning(state, command);
    case "PAUSE_GAME":
      return pauseGame(state, command);
    case "RESUME_GAME":
      return resumeGame(state, command);
    case "END_ROUND":
      return endRound(state);
    case "FINISH_RESULTS":
      return finishResults(state);
    case "PLAY_AGAIN":
      return playAgain(state);
    case "SHUFFLE_AND_PLAY":
      return shuffleAndPlay(state, command);
    case "END_EVENT":
      return endEvent(state);
    case "EMERGENCY_STOP":
      return emergencyStop(state);
  }
}

export { createInitialGameState };
