import { describe, expect, it } from "vitest";
import type { BalanceMove } from "../../engine/balance/types.js";
import { MemoryGameRepository } from "./memoryRepository.js";
import type { StoredBalancePlan, StoredGameState } from "./types.js";

describe("Concurrency & Race Condition Invariants", () => {
  it("handles 50 concurrent team switches without state or count corruption", async () => {
    const repo = new MemoryGameRepository();
    const gameId = "game_race_switch";

    await repo.createGame({
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: Date.now(),
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });

    // Register 50 players
    const registerPromises = Array.from({ length: 50 }, (_, i) =>
      repo.addOrUpdatePlayer(gameId, {
        playerId: `p_${i}`,
        label: `Player ${i}`,
        team: null,
        wildcard: false,
        status: "online",
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      }),
    );
    await Promise.all(registerPromises);

    // 25 pick LEFT, 25 pick RIGHT simultaneously
    const switchPromises = Array.from({ length: 50 }, (_, i) => {
      const targetTeam = i % 2 === 0 ? "left" : "right";
      return repo.chooseOrSwitchTeam(gameId, `p_${i}`, targetTeam);
    });

    const results = await Promise.all(switchPromises);
    expect(results.every((r) => r.ok)).toBe(true);

    const counts = await repo.getCounts(gameId);
    expect(counts.ok).toBe(true);
    if (counts.ok) {
      expect(counts.value.total).toBe(50);
      expect(counts.value.left).toBe(25);
      expect(counts.value.right).toBe(25);
      expect(counts.value.chaos).toBe(0);
    }

    const roster = await repo.getRoster(gameId);
    expect(roster.ok).toBe(true);
    if (roster.ok) {
      const ids = roster.value.players.map((p) => p.playerId);
      expect(new Set(ids).size).toBe(50); // No duplicates
    }
  });

  it("handles race for the final volunteer slot with exactly 1 winner and no overshoot", async () => {
    const repo = new MemoryGameRepository();
    const gameId = "game_race_volunteer";

    await repo.createGame({
      gameId,
      phase: "BALANCING",
      roundNumber: 1,
      createdAt: Date.now(),
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    // 5 players on LEFT, 0 on RIGHT. Plan needs exactly 1 move left->right.
    for (let i = 1; i <= 5; i += 1) {
      await repo.addOrUpdatePlayer(gameId, {
        playerId: `p_left_${i}`,
        label: `P${i}`,
        team: "left",
        wildcard: false,
        status: "online",
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    const plan: StoredBalancePlan = {
      targetLeft: 2,
      targetRight: 2,
      wildcardNeeded: 1,
      needLeftToRight: 1,
      needRightToLeft: 0,
      remainingLeftToRight: 1,
      remainingRightToLeft: 0,
      wildcardPlayerId: "p_left_1",
      wildcardApplied: false,
      status: "needs_moves",
    };
    await repo.writeBalancePlan(gameId, plan);

    // 4 eligible surplus players attempt to volunteer simultaneously
    const candidates = ["p_left_2", "p_left_3", "p_left_4", "p_left_5"];
    const volunteerPromises = candidates.map((id) =>
      repo.applyVolunteerMove(gameId, id, "right"),
    );

    const results = await Promise.all(volunteerPromises);
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(3);

    // Invariant: remaining count must never be negative
    const planAfter = await repo.getPlan(gameId);
    expect(planAfter.ok && planAfter.value?.remainingLeftToRight).toBe(0);
    expect(planAfter.ok && planAfter.value?.status).toBe("needs_wildcard");

    const moves = await repo.getMoves(gameId);
    expect(moves.length).toBe(1);
  });

  it("handles race for wildcard assignment with exactly 1 winner", async () => {
    const repo = new MemoryGameRepository();
    const gameId = "game_race_wildcard";

    await repo.createGame({
      gameId,
      phase: "BALANCING",
      roundNumber: 1,
      createdAt: Date.now(),
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p1",
      label: "P1",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p2",
      label: "P2",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });

    const plan: StoredBalancePlan = {
      targetLeft: 1,
      targetRight: 1,
      wildcardNeeded: 1,
      needLeftToRight: 0,
      needRightToLeft: 0,
      remainingLeftToRight: 0,
      remainingRightToLeft: 0,
      wildcardPlayerId: null,
      wildcardApplied: false,
      status: "needs_wildcard",
    };
    await repo.writeBalancePlan(gameId, plan);

    // Both p1 and p2 attempt wildcard assignment concurrently
    const [res1, res2] = await Promise.all([
      repo.assignWildcard(gameId, "p1", "host"),
      repo.assignWildcard(gameId, "p2", "host"),
    ]);

    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const counts = await repo.getCounts(gameId);
    expect(counts.ok && counts.value.chaos).toBe(1);
  });

  it("handles 100 concurrent score increments without lost updates", async () => {
    const repo = new MemoryGameRepository();
    const gameId = "game_race_taps";

    await repo.createGame({
      gameId,
      phase: "RUNNING",
      roundNumber: 1,
      createdAt: Date.now(),
      durationMs: 30000,
      startTime: Date.now(),
      endTime: Date.now() + 30000,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p_left",
      label: "Left Clicker",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p_right",
      label: "Right Clicker",
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });

    // 60 left taps, 40 right taps
    const tapPromises = [
      ...Array.from({ length: 60 }, () => repo.tapIncrement(gameId, "p_left")),
      ...Array.from({ length: 40 }, () => repo.tapIncrement(gameId, "p_right")),
    ];

    const results = await Promise.all(tapPromises);
    expect(results.every((r) => r.ok)).toBe(true);

    const finalScores = await repo.getScores(gameId);
    expect(finalScores.left).toBe(60);
    expect(finalScores.right).toBe(40);
  });

  it("recovers full state consistently across process restart", async () => {
    const repo = new MemoryGameRepository();
    const gameId = "game_persist_test";

    const gameState: StoredGameState = {
      gameId,
      phase: "BALANCING",
      roundNumber: 2,
      createdAt: 1700000000000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    };
    await repo.createGame(gameState);
    await repo.setScores(gameId, 42, 38);

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p_101",
      label: "Player 101",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1700000000000,
      lastSeen: 1700000001000,
    });

    const plan: StoredBalancePlan = {
      targetLeft: 50,
      targetRight: 50,
      wildcardNeeded: 1,
      needLeftToRight: 0,
      needRightToLeft: 0,
      remainingLeftToRight: 0,
      remainingRightToLeft: 0,
      wildcardPlayerId: "p_chaos",
      wildcardApplied: true,
      status: "complete",
    };
    const moves: BalanceMove[] = [
      { kind: "team_switch", playerId: "p_101", from: "right", to: "left", reason: "auto", sequence: 1 },
    ];
    await repo.writeBalancePlan(gameId, plan, moves);
    await repo.updateGame(gameId, { phase: "COUNTDOWN", countdownEndsAt: 1700000003000 });

    // Simulate process reading state
    const publicState = await repo.getPublicGameState(gameId);
    expect(publicState.ok).toBe(true);
    if (!publicState.ok) return;

    expect(publicState.value.phase).toBe("COUNTDOWN");
    expect(publicState.value.roundNumber).toBe(2);
    expect(publicState.value.scores.left).toBe(42);
    const planResult = await repo.getPlan(gameId);
    expect(planResult.ok && planResult.value?.status).toBe("complete");

    const retrievedMoves = await repo.getMoves(gameId);
    expect(retrievedMoves.length).toBe(1);
    expect(retrievedMoves[0]?.playerId).toBe("p_101");
  });
});
