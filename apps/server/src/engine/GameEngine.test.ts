import { GAME_PHASES } from "@tow/shared";
import { describe, expect, it } from "vitest";
import { canTransition } from "./machine.js";
import { isRosterReadyForCountdown } from "./roster.js";
import { createInitialGameState } from "./state.js";
import type { GameCommand, GameState, PhaseChangedEvent } from "./types.js";
import { reduceGame } from "./GameEngine.js";

function mustReduce(state: GameState, command: GameCommand): GameState {
  const result = reduceGame(state, command);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.state;
}

function phaseChanged(from: GameState["phase"], to: GameState["phase"]): PhaseChangedEvent {
  return { type: "PHASE_CHANGED", from, to };
}

const balancedPair: Pick<
  Extract<GameCommand, { type: "LOCK_GAME" }>,
  "totalPlayers" | "leftCount" | "rightCount" | "wildcardPlayerId"
> = {
  totalPlayers: 2,
  leftCount: 1,
  rightCount: 1,
  wildcardPlayerId: null,
};

const unbalanced: typeof balancedPair = {
  totalPlayers: 3,
  leftCount: 2,
  rightCount: 1,
  wildcardPlayerId: null,
};

const oddReady: typeof balancedPair = {
  totalPlayers: 3,
  leftCount: 1,
  rightCount: 1,
  wildcardPlayerId: "p-chaos",
};

function openLocked(roster: typeof balancedPair): GameState {
  const waiting = createInitialGameState("game-1");
  const open = mustReduce(waiting, { type: "OPEN_GAME" });
  return mustReduce(open, { type: "LOCK_GAME", ...roster });
}

describe("canTransition", () => {
  it("allows only the approved normal edges", () => {
    expect(canTransition("WAITING", "OPEN")).toBe(true);
    expect(canTransition("OPEN", "LOCKING")).toBe(true);
    expect(canTransition("LOCKING", "BALANCING")).toBe(true);
    expect(canTransition("LOCKING", "COUNTDOWN")).toBe(true);
    expect(canTransition("BALANCING", "COUNTDOWN")).toBe(true);
    expect(canTransition("BALANCING", "OPEN")).toBe(true);
    expect(canTransition("COUNTDOWN", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "FINISHED")).toBe(true);
    expect(canTransition("PAUSED", "FINISHED")).toBe(true);
    expect(canTransition("FINISHED", "RESULTS")).toBe(true);
    expect(canTransition("RESULTS", "COUNTDOWN")).toBe(true);
    expect(canTransition("RESULTS", "BALANCING")).toBe(true);
    expect(canTransition("RESULTS", "WAITING")).toBe(true);
  });

  it("rejects emergency WAITING unless the emergency flag is set", () => {
    expect(canTransition("RUNNING", "WAITING")).toBe(false);
    expect(canTransition("RUNNING", "WAITING", true)).toBe(true);
    expect(canTransition("WAITING", "WAITING", true)).toBe(true);
  });
});

describe("isRosterReadyForCountdown", () => {
  it("accepts even equal teams without chaos", () => {
    expect(isRosterReadyForCountdown(balancedPair)).toBe(true);
  });

  it("accepts odd equal teams with chaos", () => {
    expect(isRosterReadyForCountdown(oddReady)).toBe(true);
  });

  it("rejects odd totals without chaos", () => {
    expect(isRosterReadyForCountdown(unbalanced)).toBe(false);
  });
});

describe("reduceGame valid transitions", () => {
  it("WAITING -> OPEN", () => {
    const before = createInitialGameState("game-1");
    const result = reduceGame(before, { type: "OPEN_GAME" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("OPEN");
    expect(result.state.roundNumber).toBe(1);
    expect(result.events).toEqual([phaseChanged("WAITING", "OPEN")]);
  });

  it("OPEN -> LOCKING", () => {
    const open = mustReduce(createInitialGameState("game-1"), { type: "OPEN_GAME" });
    const result = reduceGame(open, { type: "LOCK_GAME", ...unbalanced });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("LOCKING");
    expect(result.state.leftCount).toBe(2);
    expect(result.events).toEqual([phaseChanged("OPEN", "LOCKING")]);
  });

  it("LOCKING -> BALANCING when the roster is not ready", () => {
    const locking = openLocked(unbalanced);
    const result = reduceGame(locking, { type: "RESOLVE_LOCK" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("BALANCING");
    expect(result.events).toEqual([phaseChanged("LOCKING", "BALANCING")]);
  });

  it("LOCKING -> COUNTDOWN when the roster is ready", () => {
    const locking = openLocked(balancedPair);
    const result = reduceGame(locking, { type: "RESOLVE_LOCK" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("COUNTDOWN");
    expect(result.events).toEqual([phaseChanged("LOCKING", "COUNTDOWN")]);
  });

  it("BALANCING -> COUNTDOWN when the plan is satisfied", () => {
    const balancing = mustReduce(openLocked(unbalanced), { type: "RESOLVE_LOCK" });
    expect(balancing.phase).toBe("BALANCING");
    const ready: GameState = { ...balancing, ...oddReady };
    const result = reduceGame(ready, { type: "COMPLETE_BALANCE" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("COUNTDOWN");
    expect(result.events).toEqual([phaseChanged("BALANCING", "COUNTDOWN")]);
  });

  it("BALANCING -> OPEN on cancel", () => {
    const balancing = mustReduce(openLocked(unbalanced), { type: "RESOLVE_LOCK" });
    const result = reduceGame(balancing, { type: "CANCEL_BALANCING" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("OPEN");
    expect(result.events).toEqual([phaseChanged("BALANCING", "OPEN")]);
  });

  it("COUNTDOWN -> RUNNING", () => {
    const countdown = mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" });
    const result = reduceGame(countdown, { type: "START_RUNNING", now: 1_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("RUNNING");
    expect(result.state.startTime).toBe(1_000);
    expect(result.state.endTime).toBe(1_000 + countdown.durationMs);
    expect(result.events).toEqual([phaseChanged("COUNTDOWN", "RUNNING")]);
  });

  it("RUNNING -> PAUSED", () => {
    const running = mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
      type: "START_RUNNING",
      now: 1_000,
    });
    const result = reduceGame(running, { type: "PAUSE_GAME", now: 1_500 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("PAUSED");
    expect(result.state.pausedAt).toBe(1_500);
    expect(result.events).toEqual([phaseChanged("RUNNING", "PAUSED")]);
  });

  it("PAUSED -> RUNNING preserves remaining time", () => {
    const running = mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
      type: "START_RUNNING",
      now: 1_000,
    });
    const paused = mustReduce(running, { type: "PAUSE_GAME", now: 1_500 });
    const result = reduceGame(paused, { type: "RESUME_GAME", now: 1_800 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("RUNNING");
    expect(result.state.pausedAt).toBeNull();
    expect(result.state.pauseAccumMs).toBe(300);
    expect(result.state.endTime).toBe((running.endTime ?? 0) + 300);
    expect(result.events).toEqual([phaseChanged("PAUSED", "RUNNING")]);
  });

  it("RUNNING -> FINISHED", () => {
    const running: GameState = {
      ...mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
        type: "START_RUNNING",
        now: 1_000,
      }),
      leftScore: 10,
      rightScore: 7,
    };
    const result = reduceGame(running, { type: "END_ROUND" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("FINISHED");
    expect(result.state.winner).toBe("left");
    expect(result.events).toEqual([phaseChanged("RUNNING", "FINISHED")]);
  });

  it("PAUSED -> FINISHED", () => {
    const paused = mustReduce(
      mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
        type: "START_RUNNING",
        now: 1_000,
      }),
      { type: "PAUSE_GAME", now: 1_200 },
    );
    const result = reduceGame(paused, { type: "END_ROUND" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("FINISHED");
    expect(result.events).toEqual([phaseChanged("PAUSED", "FINISHED")]);
  });

  it("FINISHED -> RESULTS", () => {
    const finished = mustReduce(
      mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
        type: "START_RUNNING",
        now: 1_000,
      }),
      { type: "END_ROUND" },
    );
    const result = reduceGame(finished, { type: "FINISH_RESULTS" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("RESULTS");
    expect(result.events).toEqual([phaseChanged("FINISHED", "RESULTS")]);
  });

  it("RESULTS -> COUNTDOWN on play again", () => {
    const results = toResults();
    const result = reduceGame(results, { type: "PLAY_AGAIN" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("COUNTDOWN");
    expect(result.state.roundNumber).toBe(results.roundNumber + 1);
    expect(result.state.leftScore).toBe(0);
    expect(result.state.winner).toBeNull();
    expect(result.events).toEqual([phaseChanged("RESULTS", "COUNTDOWN")]);
  });

  it("RESULTS -> BALANCING when shuffle requires balancing", () => {
    const results = toResults();
    const result = reduceGame(results, { type: "SHUFFLE_AND_PLAY", balancingRequired: true });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("BALANCING");
    expect(result.events).toEqual([phaseChanged("RESULTS", "BALANCING")]);
  });

  it("RESULTS -> WAITING on end event", () => {
    const results = toResults();
    const result = reduceGame(results, { type: "END_EVENT" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe("WAITING");
    expect(result.state.roundNumber).toBe(0);
    expect(result.events).toEqual([
      phaseChanged("RESULTS", "WAITING"),
      { type: "GAME_RESET", reason: "end_event" },
    ]);
  });

  it("ANY -> WAITING through emergency/reset", () => {
    for (const phase of GAME_PHASES) {
      const before: GameState = { ...createInitialGameState("game-1"), phase };
      const result = reduceGame(before, { type: "EMERGENCY_STOP" });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.state.phase).toBe("WAITING");
      expect(result.events.some((event) => event.type === "GAME_RESET")).toBe(true);
      if (phase !== "WAITING") {
        expect(result.events).toContainEqual(phaseChanged(phase, "WAITING"));
      }
    }
  });
});

function toResults(): GameState {
  const finished = mustReduce(
    mustReduce(mustReduce(openLocked(balancedPair), { type: "RESOLVE_LOCK" }), {
      type: "START_RUNNING",
      now: 1_000,
    }),
    { type: "END_ROUND" },
  );
  return mustReduce(finished, { type: "FINISH_RESULTS" });
}

describe("reduceGame invalid transitions", () => {
  const cases: { from: GameState["phase"]; command: GameCommand; to: GameState["phase"] }[] = [
    { from: "WAITING", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "WAITING", command: { type: "PAUSE_GAME", now: 0 }, to: "PAUSED" },
    { from: "WAITING", command: { type: "FINISH_RESULTS" }, to: "RESULTS" },
    { from: "OPEN", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "OPEN", command: { type: "END_ROUND" }, to: "FINISHED" },
    { from: "LOCKING", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "BALANCING", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "COUNTDOWN", command: { type: "PAUSE_GAME", now: 0 }, to: "PAUSED" },
    { from: "COUNTDOWN", command: { type: "END_ROUND" }, to: "FINISHED" },
    { from: "FINISHED", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "FINISHED", command: { type: "PAUSE_GAME", now: 0 }, to: "PAUSED" },
    { from: "RESULTS", command: { type: "START_RUNNING", now: 0 }, to: "RUNNING" },
    { from: "RESULTS", command: { type: "OPEN_GAME" }, to: "OPEN" },
  ];

  it.each(cases)("rejects $from -> $to", ({ from, command, to }) => {
    const before: GameState = { ...createInitialGameState("game-1"), phase: from };
    const snapshot = structuredClone(before);
    const result = reduceGame(before, command);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("INVALID_TRANSITION");
    expect(result.error.message).toBe(`Cannot transition from ${from} to ${to}`);
    expect(before).toEqual(snapshot);
  });
});

describe("reduceGame determinism and immutability", () => {
  it("does not mutate the original state on success", () => {
    const before = createInitialGameState("game-1");
    const snapshot = structuredClone(before);
    const result = reduceGame(before, { type: "OPEN_GAME" });
    expect(result.ok).toBe(true);
    expect(before).toEqual(snapshot);
    expect(before.phase).toBe("WAITING");
  });

  it("is deterministic for the same input", () => {
    const before = openLocked(balancedPair);
    const a = reduceGame(before, { type: "RESOLVE_LOCK" });
    const b = reduceGame(before, { type: "RESOLVE_LOCK" });
    expect(a).toEqual(b);
  });
});
