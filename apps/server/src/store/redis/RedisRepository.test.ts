import { beforeEach, describe, expect, it } from "vitest";
import type { BalanceMove } from "../../engine/balance/types.js";
import { MemoryGameRepository } from "./memoryRepository.js";
import type { StoredBalancePlan, StoredGameState, StoredPlayer } from "./types.js";

describe("GameRepository — Core Operations & State Reconstruction", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_test_1";

  beforeEach(() => {
    repo = new MemoryGameRepository();
  });

  it("manages session pointer for permanent QR /join", async () => {
    expect(await repo.getCurrentGameId()).toBeNull();

    await repo.setCurrentGameId("game_live_999");
    expect(await repo.getCurrentGameId()).toBe("game_live_999");

    await repo.clearCurrentGameId();
    expect(await repo.getCurrentGameId()).toBeNull();
  });

  it("creates, reads, and updates game state", async () => {
    const initial: StoredGameState = {
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    };

    const created = await repo.createGame(initial);
    expect(created.ok).toBe(true);

    const fetched = await repo.getGame(gameId);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.value.phase).toBe("OPEN");
      expect(fetched.value.joinAllowed).toBe(true);
    }

    const updated = await repo.updateGame(gameId, { phase: "RUNNING", startTime: 5000 });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.phase).toBe("RUNNING");
      expect(updated.value.startTime).toBe(5000);
    }
  });

  it("reconstructs PublicState accurately", async () => {
    await repo.createGame({
      gameId,
      phase: "BALANCING",
      roundNumber: 1,
      createdAt: 1000,
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
      label: "Alpha",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p2",
      label: "Beta",
      team: "right",
      wildcard: false,
      status: "offline",
      joinedAt: 1000,
      lastSeen: 1000,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p3",
      label: "ChaosMaster",
      team: null,
      wildcard: true,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });

    const publicState = await repo.getPublicGameState(gameId);
    expect(publicState.ok).toBe(true);
    if (!publicState.ok) return;

    expect(publicState.value.counts).toEqual({
      left: 1,
      right: 1,
      chaos: 1,
      online: 2,
      offline: 1,
      total: 3,
    });
    expect(publicState.value.chaosPlayerId).toBe("p3");
    expect(publicState.value.chaosLabel).toBe("ChaosMaster");
  });
});

describe("GameRepository — Atomic Operation #1: chooseOrSwitchTeam", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_switch_test";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    await repo.createGame({
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p1",
      label: "Player 1",
      team: null,
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
  });

  it("assigns unassigned player to LEFT", async () => {
    const result = await repo.chooseOrSwitchTeam(gameId, "p1", "left");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.previousTeam).toBeNull();
    expect(result.value.newTeam).toBe("left");
    expect(result.value.counts.left).toBe(1);
    expect(result.value.counts.right).toBe(0);

    const player = await repo.getPlayer(gameId, "p1");
    expect(player.ok && player.value.team).toBe("left");
  });

  it("switches player from LEFT to RIGHT", async () => {
    await repo.chooseOrSwitchTeam(gameId, "p1", "left");

    const switched = await repo.chooseOrSwitchTeam(gameId, "p1", "right");
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;

    expect(switched.value.previousTeam).toBe("left");
    expect(switched.value.newTeam).toBe("right");
    expect(switched.value.counts.left).toBe(0);
    expect(switched.value.counts.right).toBe(1);

    const player = await repo.getPlayer(gameId, "p1");
    expect(player.ok && player.value.team).toBe("right");
  });

  it("is idempotent when selecting current team", async () => {
    await repo.chooseOrSwitchTeam(gameId, "p1", "left");
    const repeat = await repo.chooseOrSwitchTeam(gameId, "p1", "left");
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) return;

    expect(repeat.value.previousTeam).toBe("left");
    expect(repeat.value.newTeam).toBe("left");
    expect(repeat.value.counts.left).toBe(1);
  });

  it("rejects switch when phase is not OPEN", async () => {
    await repo.updateGame(gameId, { phase: "LOCKING", joinAllowed: false });
    const result = await repo.chooseOrSwitchTeam(gameId, "p1", "left");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PHASE");
    }
  });

  it("rejects switch for nonexistent player", async () => {
    const result = await repo.chooseOrSwitchTeam(gameId, "ghost_player", "left");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PLAYER_NOT_FOUND");
    }
  });
});

describe("GameRepository — Atomic Operation #2: lockAndSnapshot", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_lock_test";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    await repo.createGame({
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p1",
      label: "P1",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p2",
      label: "P2",
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
  });

  it("freezes game to LOCKING and returns authoritative roster snapshot", async () => {
    const result = await repo.lockAndSnapshot(gameId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.phase).toBe("LOCKING");
    expect(result.value.leftCount).toBe(1);
    expect(result.value.rightCount).toBe(1);
    expect(result.value.wildcardCount).toBe(0);
    expect(result.value.totalPlayers).toBe(2);
    expect(result.value.roster.length).toBe(2);

    const game = await repo.getGame(gameId);
    expect(game.ok && game.value.phase).toBe("LOCKING");
    expect(game.ok && game.value.joinAllowed).toBe(false);
  });

  it("rejects lock if game is not in OPEN phase", async () => {
    await repo.updateGame(gameId, { phase: "WAITING" });
    const result = await repo.lockAndSnapshot(gameId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PHASE");
    }
  });
});

describe("GameRepository — Atomic Operation #3 & #4: Balance Plan & Volunteer", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_balance_test";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    await repo.createGame({
      gameId,
      phase: "BALANCING",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    // 3 players on left, 0 on right (target: 1 L, 1 R, 1 CHAOS, 1 move left->right)
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-left-001",
      label: "P1",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-left-002",
      label: "P2",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-left-003",
      label: "P3",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });

    const plan: StoredBalancePlan = {
      targetLeft: 1,
      targetRight: 1,
      wildcardNeeded: 1,
      needLeftToRight: 1,
      needRightToLeft: 0,
      remainingLeftToRight: 1,
      remainingRightToLeft: 0,
      wildcardPlayerId: "p-left-001",
      wildcardApplied: false,
      status: "needs_moves",
    };
    await repo.writeBalancePlan(gameId, plan);
  });

  it("applies valid volunteer move atomically", async () => {
    const result = await repo.applyVolunteerMove(gameId, "p-left-002", "right");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.move).toEqual({
      kind: "team_switch",
      playerId: "p-left-002",
      from: "left",
      to: "right",
      reason: "volunteer",
      sequence: 1,
    });
    expect(result.value.remainingLeftToRight).toBe(0);
    expect(result.value.status).toBe("needs_wildcard");

    const player = await repo.getPlayer(gameId, "p-left-002");
    expect(player.ok && player.value.team).toBe("right");

    const moves = await repo.getMoves(gameId);
    expect(moves.length).toBe(1);
  });

  it("rejects volunteer by wildcard player", async () => {
    const result = await repo.applyVolunteerMove(gameId, "p-left-001", "right");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MOVE_NOT_ALLOWED");
    }
  });

  it("rejects volunteer that would overshoot target", async () => {
    await repo.applyVolunteerMove(gameId, "p-left-002", "right");

    // Extra volunteer attempt
    const extra = await repo.applyVolunteerMove(gameId, "p-left-003", "right");
    expect(extra.ok).toBe(false);
    if (!extra.ok) {
      expect(extra.error.code).toBe("MOVE_WOULD_OVERSHOOT");
    }
  });
});

describe("GameRepository — Atomic Operation #5 & #6: Wildcard & Auto-Balance", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_auto_test";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    await repo.createGame({
      gameId,
      phase: "BALANCING",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    for (let i = 1; i <= 5; i += 1) {
      await repo.addOrUpdatePlayer(gameId, {
        playerId: `p${i}`,
        label: `Player ${i}`,
        team: "left",
        wildcard: false,
        status: "online",
        joinedAt: 1000,
        lastSeen: 1000,
      });
    }

    const plan: StoredBalancePlan = {
      targetLeft: 2,
      targetRight: 2,
      wildcardNeeded: 1,
      needLeftToRight: 2,
      needRightToLeft: 0,
      remainingLeftToRight: 2,
      remainingRightToLeft: 0,
      wildcardPlayerId: "p1",
      wildcardApplied: false,
      status: "needs_moves",
    };
    await repo.writeBalancePlan(gameId, plan);
  });

  it("assigns wildcard atomically", async () => {
    const result = await repo.assignWildcard(gameId, "p1", "host");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.wildcardPlayerId).toBe("p1");
    expect(result.value.move.kind).toBe("wildcard");

    const counts = await repo.getCounts(gameId);
    expect(counts.ok && counts.value.chaos).toBe(1);
    expect(counts.ok && counts.value.left).toBe(4);
  });

  it("applies deterministic auto-balance moves atomically", async () => {
    const autoMoves: BalanceMove[] = [
      { kind: "team_switch", playerId: "p2", from: "left", to: "right", reason: "auto", sequence: 1 },
      { kind: "team_switch", playerId: "p3", from: "left", to: "right", reason: "auto", sequence: 2 },
      { kind: "wildcard", playerId: "p1", from: "left", to: "chaos", reason: "auto", sequence: 3 },
    ];

    const result = await repo.applyAutoBalance(gameId, autoMoves);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.movesApplied).toBe(3);
    expect(result.value.status).toBe("complete");
    expect(result.value.counts).toEqual({
      left: 2,
      right: 2,
      chaos: 1,
      online: 5,
      offline: 0,
      total: 5,
    });

    const storedMoves = await repo.getMoves(gameId);
    expect(storedMoves.length).toBe(3);
  });

  it("aborts auto-balance if a player moved concurrently", async () => {
    // Manually switch p2 to right beforehand to simulate race
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p2",
      label: "Player 2",
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });

    const autoMoves: BalanceMove[] = [
      { kind: "team_switch", playerId: "p2", from: "left", to: "right", reason: "auto", sequence: 1 },
    ];

    const result = await repo.applyAutoBalance(gameId, autoMoves);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONCURRENT_MODIFICATION");
    }
  });
});

describe("GameRepository — Atomic Operation #7: tapIncrement", () => {
  let repo: MemoryGameRepository;
  const gameId = "game_tap_test";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    await repo.createGame({
      gameId,
      phase: "RUNNING",
      roundNumber: 1,
      createdAt: 1000,
      durationMs: 30000,
      startTime: 1000,
      endTime: 31000,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: false,
    });

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-left",
      label: "Left Clicker",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-right",
      label: "Right Clicker",
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "p-chaos",
      label: "Chaos Player",
      team: null,
      wildcard: true,
      status: "online",
      joinedAt: 1000,
      lastSeen: 1000,
    });
  });

  it("increments score atomically for valid team players", async () => {
    const tap1 = await repo.tapIncrement(gameId, "p-left");
    expect(tap1.ok).toBe(true);
    if (tap1.ok) {
      expect(tap1.value.team).toBe("left");
      expect(tap1.value.newScore).toBe(1);
      expect(tap1.value.scores).toEqual({ left: 1, right: 0 });
      expect(tap1.value.seq).toBe(1);
    }

    const tap2 = await repo.tapIncrement(gameId, "p-right");
    expect(tap2.ok).toBe(true);
    if (tap2.ok) {
      expect(tap2.value.team).toBe("right");
      expect(tap2.value.newScore).toBe(1);
      expect(tap2.value.scores).toEqual({ left: 1, right: 1 });
      expect(tap2.value.seq).toBe(2);
    }
  });

  it("rejects taps when phase is not RUNNING", async () => {
    await repo.updateGame(gameId, { phase: "PAUSED" });
    const tap = await repo.tapIncrement(gameId, "p-left");
    expect(tap.ok).toBe(false);
    if (!tap.ok) {
      expect(tap.error.code).toBe("INVALID_PHASE");
    }
  });

  it("rejects tap from CHAOS player", async () => {
    const tap = await repo.tapIncrement(gameId, "p-chaos");
    expect(tap.ok).toBe(false);
    if (!tap.ok) {
      expect(tap.error.code).toBe("INVALID_TEAM");
    }
  });
});

describe("Tap Rate Limiting", () => {
  let repo: MemoryGameRepository;

  beforeEach(() => {
    repo = new MemoryGameRepository();
  });

  it("allows taps within burst allowance and limits when exceeded", async () => {
    const playerId = "speed_tapper";
    const config = { windowMs: 1000, maxBurst: 5 };

    // 5 taps within limit
    for (let i = 1; i <= 5; i += 1) {
      const res = await repo.checkRateLimit(playerId, config);
      expect(res.allowed).toBe(true);
      expect(res.current).toBe(i);
    }

    // 6th tap exceeds limit
    const exceeded = await repo.checkRateLimit(playerId, config);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.current).toBe(6);
    expect(typeof exceeded.retryAfterMs).toBe("number");
  });
});
