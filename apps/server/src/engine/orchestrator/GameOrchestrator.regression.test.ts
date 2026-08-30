/**
 * Regression Tests: Critical Bug Fixes #1, #2, #3, #6
 * - #1: GameEngine validates all lifecycle transitions
 * - #2: COUNTDOWN→RUNNING cannot execute multiple times (race guard)
 * - #3: startCountdown from invalid phases is rejected
 * - #6: cancelBalancing and lockGame are idempotent under concurrent calls
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import { GameOrchestrator } from "./GameOrchestrator.js";

function makeOrchestrator(repo: MemoryGameRepository) {
  return new GameOrchestrator(repo);
}

async function openAndAddPlayers(
  orchestrator: GameOrchestrator,
  repo: MemoryGameRepository,
  leftCount = 2,
  rightCount = 2,
) {
  const openRes = await orchestrator.openGame();
  expect(openRes.ok).toBe(true);
  const gameId = (openRes as any).data.gameId;

  for (let i = 0; i < leftCount; i++) {
    await repo.addOrUpdatePlayer(gameId, {
      playerId: `l${i}`,
      label: `L-${i}`,
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
  }
  for (let i = 0; i < rightCount; i++) {
    await repo.addOrUpdatePlayer(gameId, {
      playerId: `r${i}`,
      label: `R-${i}`,
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
  }
  return gameId;
}

describe("Regression #1: GameEngine validates lifecycle transitions", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new MemoryGameRepository();
    orchestrator = makeOrchestrator(repo);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it("lockGame is rejected from WAITING phase (no open game)", async () => {
    // No openGame() called — no current game ID
    const res = await orchestrator.lockGame();
    expect(res.ok).toBe(false);
    expect((res as any).code).toBe("GAME_NOT_FOUND");
  });

  it("cancelBalancing is rejected from OPEN phase via GameEngine", async () => {
    await openAndAddPlayers(orchestrator, repo);
    // Do NOT lock — game is OPEN
    const res = await orchestrator.cancelBalancing();
    expect(res.ok).toBe(false);
    expect((res as any).code).toBe("INVALID_TRANSITION");
  });

  it("cancelBalancing succeeds from BALANCING phase", async () => {
    await openAndAddPlayers(orchestrator, repo, 4, 0); // unbalanced → BALANCING
    const lockRes = await orchestrator.lockGame();
    expect(lockRes.ok).toBe(true);
    expect((lockRes as any).data.phase).toBe("BALANCING");

    const cancelRes = await orchestrator.cancelBalancing();
    expect(cancelRes.ok).toBe(true);

    const gameId = await repo.getCurrentGameId();
    const game = await repo.getGame(gameId!);
    expect(game.ok && game.value.phase).toBe("OPEN");
  });
});

describe("Regression #2: COUNTDOWN→RUNNING race guard", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new MemoryGameRepository();
    orchestrator = makeOrchestrator(repo);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it("two simultaneous completeCountdown calls: exactly one succeeds", async () => {
    const gameId = await openAndAddPlayers(orchestrator, repo);
    const lockRes = await orchestrator.lockGame();
    expect(lockRes.ok).toBe(true);
    expect((lockRes as any).data.phase).toBe("COUNTDOWN");

    // Both called concurrently — only one should transition to RUNNING
    const [r1, r2] = await Promise.all([
      orchestrator.completeCountdown(gameId),
      orchestrator.completeCountdown(gameId),
    ]);

    // Exactly one should succeed
    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    // Failure must be INVALID_PHASE (not an unhandled error)
    expect((failures[0] as any).code).toBe("INVALID_TRANSITION");

    // Game is in RUNNING phase
    const game = await repo.getGame(gameId);
    expect(game.ok && game.value.phase).toBe("RUNNING");
  });

  it("startRunning from RUNNING phase is rejected", async () => {
    const gameId = await openAndAddPlayers(orchestrator, repo);
    await orchestrator.lockGame(); // → COUNTDOWN (balanced)
    const runRes = await repo.startRunning(gameId, Date.now());
    expect(runRes.ok).toBe(true); // first call: COUNTDOWN→RUNNING ✓

    const runRes2 = await repo.startRunning(gameId, Date.now());
    expect(runRes2.ok).toBe(false);
    expect(runRes2.ok === false && runRes2.error.code).toBe("INVALID_PHASE");
  });
});

describe("Regression #3: startCountdown rejects invalid source phases", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new MemoryGameRepository();
    orchestrator = makeOrchestrator(repo);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it("startCountdown from OPEN phase is rejected", async () => {
    await openAndAddPlayers(orchestrator, repo);
    // game is OPEN — countdown must not be allowed
    const res = await orchestrator.startCountdown(3000);
    expect(res.ok).toBe(false);
    expect((res as any).code).toBe("INVALID_TRANSITION");
  });

  it("startCountdown from RUNNING phase is rejected", async () => {
    const gameId = await openAndAddPlayers(orchestrator, repo);
    await orchestrator.lockGame(); // COUNTDOWN
    await repo.startRunning(gameId, Date.now()); // RUNNING

    const res = await orchestrator.startCountdown(3000);
    expect(res.ok).toBe(false);
    expect((res as any).code).toBe("INVALID_TRANSITION");
  });

  it("startCountdown from BALANCING succeeds when balanced", async () => {
    const gameId = await openAndAddPlayers(orchestrator, repo, 2, 2);
    await orchestrator.lockGame(); // balanced → COUNTDOWN (skips BALANCING)
    // game is already COUNTDOWN, startCountdown from COUNTDOWN is also invalid per machine.ts
    // Let's test the actual BALANCING→COUNTDOWN path with unbalanced then balanced roster:
    const repo2 = new MemoryGameRepository();
    const orch2 = new GameOrchestrator(repo2);

    const gId = await openAndAddPlayers(orch2, repo2, 4, 0);
    const lockRes = await orch2.lockGame();
    expect((lockRes as any).data.phase).toBe("BALANCING");

    // Auto-balance to make it even
    const balRes = await orch2.confirmAutoBalance();
    expect(balRes.ok).toBe(true);
    // confirmAutoBalance internally calls startCountdownInternal → COUNTDOWN
    const game = await repo2.getGame(gId);
    expect(game.ok && game.value.phase).toBe("COUNTDOWN");

    orch2.dispose();
  });
});

describe("Regression #6: lockGame concurrent guard", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new MemoryGameRepository();
    orchestrator = makeOrchestrator(repo);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it("two simultaneous lockGame calls: exactly one wins", async () => {
    await openAndAddPlayers(orchestrator, repo, 4, 0); // unbalanced → BALANCING

    const [r1, r2] = await Promise.all([
      orchestrator.lockGame(),
      orchestrator.lockGame(),
    ]);

    const ok = [r1, r2].filter((r) => r.ok);
    const bad = [r1, r2].filter((r) => !r.ok);
    expect(ok.length).toBe(1);
    expect(bad.length).toBe(1);
    // The losing call should be INVALID_TRANSITION or INVALID_PHASE (not a crash)
    expect(["INVALID_TRANSITION", "INVALID_PHASE"].includes((bad[0] as any).code)).toBe(true);
  });

  it("two simultaneous cancelBalancing calls: exactly one wins", async () => {
    await openAndAddPlayers(orchestrator, repo, 4, 0);
    await orchestrator.lockGame(); // BALANCING

    const [r1, r2] = await Promise.all([
      orchestrator.cancelBalancing(),
      orchestrator.cancelBalancing(),
    ]);

    const ok = [r1, r2].filter((r) => r.ok);
    expect(ok.length).toBe(1);
    // Game reverted to OPEN exactly once
    const gameId = await repo.getCurrentGameId();
    const game = await repo.getGame(gameId!);
    expect(game.ok && game.value.phase).toBe("OPEN");
  });
});
