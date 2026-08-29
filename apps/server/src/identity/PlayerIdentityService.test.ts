import { beforeEach, describe, expect, it } from "vitest";
import type { GamePhase } from "@tow/shared";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import type { StoredGameState } from "../store/redis/types.js";
import { PlayerIdentityService } from "./service.js";

describe("PlayerIdentityService — Registration, Resumption, and Reconnection", () => {
  let repo: MemoryGameRepository;
  let service: PlayerIdentityService;
  let simulatedTime: number;

  const gameId = "game_identity_test_1";

  beforeEach(async () => {
    simulatedTime = 1700000000000;
    repo = new MemoryGameRepository();
    service = new PlayerIdentityService(repo, {
      tokenSecret: "test-identity-secret",
      clock: { now: () => simulatedTime },
      disconnectGraceMs: 120_000,
    });

    const game: StoredGameState = {
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: simulatedTime,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    };
    await repo.createGame(game);
    await repo.setCurrentGameId(gameId);
  });

  it("registers first participant with display label P-001 and signed token", async () => {
    const result = await service.registerOrResume({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.isNew).toBe(true);
    expect(result.data.player.label).toBe("P-001");
    expect(typeof result.data.player.playerId).toBe("string");
    expect(typeof result.data.token).toBe("string");
    expect(result.data.publicState.phase).toBe("OPEN");

    // Check player stored in repository
    const stored = await repo.getPlayer(gameId, result.data.player.playerId);
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.label).toBe("P-001");
      expect(stored.value.status).toBe("online");
    }
  });

  it("registers sequential participants with distinct labels P-001, P-002, P-003", async () => {
    const p1 = await service.registerOrResume({});
    const p2 = await service.registerOrResume({});
    const p3 = await service.registerOrResume({});

    expect(p1.ok && p1.data.player.label).toBe("P-001");
    expect(p2.ok && p2.data.player.label).toBe("P-002");
    expect(p3.ok && p3.data.player.label).toBe("P-003");

    // Distinct player IDs
    const ids = [
      p1.ok && p1.data.player.playerId,
      p2.ok && p2.data.player.playerId,
      p3.ok && p3.data.player.playerId,
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it("resumes existing player idempotently when valid token is supplied (no duplicate)", async () => {
    const registered = await service.registerOrResume({});
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;

    const originalToken = registered.data.token;
    const originalPlayerId = registered.data.player.playerId;

    // Simulate page refresh / reconnect with same token
    const resumed = await service.registerOrResume({ token: originalToken });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;

    expect(resumed.data.isNew).toBe(false);
    expect(resumed.data.player.playerId).toBe(originalPlayerId);
    expect(resumed.data.player.label).toBe("P-001");

    // Total player count must remain 1
    const counts = await repo.getCounts(gameId);
    expect(counts.ok && counts.value.total).toBe(1);
  });

  it("handles duplicate tabs cleanly with identical identity resolution", async () => {
    const firstTab = await service.registerOrResume({});
    expect(firstTab.ok).toBe(true);
    if (!firstTab.ok) return;

    const token = firstTab.data.token;

    // Second tab opens with same token
    const secondTab = await service.registerOrResume({ token });
    expect(secondTab.ok).toBe(true);
    if (!secondTab.ok) return;

    expect(secondTab.data.player.playerId).toBe(firstTab.data.player.playerId);
    expect(secondTab.data.isNew).toBe(false);

    // Total player count remains 1
    const counts = await repo.getCounts(gameId);
    expect(counts.ok && counts.value.total).toBe(1);
  });

  it("rejects token from an expired or different game session with SESSION_REPLACED", async () => {
    const oldService = new PlayerIdentityService(repo, {
      tokenSecret: "test-identity-secret",
      clock: { now: () => simulatedTime },
    });

    const oldRegistration = await oldService.registerOrResume({});
    expect(oldRegistration.ok).toBe(true);
    if (!oldRegistration.ok) return;

    // Switch current session pointer to a new game
    const newGameId = "game_new_session_2";
    await repo.createGame({
      gameId: newGameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: simulatedTime,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });
    await repo.setCurrentGameId(newGameId);

    // Try resuming on the new session using old token
    const result = await service.registerOrResume({ token: oldRegistration.data.token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SESSION_REPLACED");
    }
  });

  it("rejects registration when no game session is active", async () => {
    await repo.clearCurrentGameId();

    const result = await service.registerOrResume({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("GAME_NOT_FOUND");
    }
  });
});

describe("PlayerIdentityService — Late Join Policy across all phases", () => {
  let repo: MemoryGameRepository;
  let service: PlayerIdentityService;
  const gameId = "game_phase_matrix";

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    service = new PlayerIdentityService(repo, { tokenSecret: "test-secret" });
    await repo.setCurrentGameId(gameId);
  });

  const nonOpenPhases: GamePhase[] = [
    "WAITING",
    "LOCKING",
    "BALANCING",
    "COUNTDOWN",
    "RUNNING",
    "PAUSED",
    "FINISHED",
    "RESULTS",
  ];

  it.each(nonOpenPhases)(
    "rejects new player registration when game is in %s phase with JOIN_CLOSED",
    async (phase) => {
      await repo.createGame({
        gameId,
        phase,
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

      const result = await service.registerOrResume({});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("JOIN_CLOSED");
      }
    },
  );

  it.each(nonOpenPhases)(
    "allows existing player with valid token to reconnect during %s phase",
    async (phase) => {
      // 1. Register player during OPEN phase
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

      const registered = await service.registerOrResume({});
      expect(registered.ok).toBe(true);
      if (!registered.ok) return;

      const token = registered.data.token;
      const playerId = registered.data.player.playerId;

      // Assign player to left
      await repo.chooseOrSwitchTeam(gameId, playerId, "left");

      // 2. Transition game to another phase (e.g. LOCKING, RUNNING, RESULTS)
      await repo.updateGame(gameId, { phase });

      // 3. Reconnect with token
      const reconnected = await service.registerOrResume({ token });
      expect(reconnected.ok).toBe(true);
      if (!reconnected.ok) return;

      expect(reconnected.data.isNew).toBe(false);
      expect(reconnected.data.player.playerId).toBe(playerId);
      expect(reconnected.data.player.team).toBe("left");
    },
  );
});

describe("PlayerIdentityService — Disconnect Grace Period & Invariants", () => {
  let repo: MemoryGameRepository;
  let service: PlayerIdentityService;
  let simulatedTime: number;
  const gameId = "game_grace_test";

  beforeEach(async () => {
    simulatedTime = 1000;
    repo = new MemoryGameRepository();
    service = new PlayerIdentityService(repo, {
      tokenSecret: "test-secret",
      disconnectGraceMs: 120_000, // 120 seconds
      clock: { now: () => simulatedTime },
    });

    await repo.createGame({
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: simulatedTime,
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });
    await repo.setCurrentGameId(gameId);
  });

  it("does not abandon player if disconnect duration is within 120s grace period during OPEN", async () => {
    const reg = await service.registerOrResume({});
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    // Advance time by 60 seconds (within grace)
    simulatedTime += 60_000;

    const evaluation = await service.evaluateGracePeriod(gameId, 120_000, simulatedTime);
    expect(evaluation.abandonedPlayerIds.length).toBe(0);

    const player = await repo.getPlayer(gameId, reg.data.player.playerId);
    expect(player.ok && player.value.status).toBe("online");
  });

  it("abandons player if inactive for > 120s during OPEN phase", async () => {
    const reg = await service.registerOrResume({});
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    // Advance time by 130 seconds (exceeds grace)
    simulatedTime += 130_000;

    const evaluation = await service.evaluateGracePeriod(gameId, 120_000, simulatedTime);
    expect(evaluation.abandonedPlayerIds).toContain(reg.data.player.playerId);

    const player = await repo.getPlayer(gameId, reg.data.player.playerId);
    expect(player.ok && player.value.status).toBe("abandoned");
  });

  it("NEVER abandons players after game has transitioned to LOCKING or RUNNING", async () => {
    const reg = await service.registerOrResume({});
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    // Transition game to LOCKING
    await repo.updateGame(gameId, { phase: "LOCKING", joinAllowed: false });

    // Advance time by 300 seconds
    simulatedTime += 300_000;

    const evaluation = await service.evaluateGracePeriod(gameId, 120_000, simulatedTime);
    expect(evaluation.abandonedPlayerIds.length).toBe(0);

    // Direct attempt to mark abandoned must also fail after LOCKING
    const marked = await service.markPlayerAbandoned(gameId, reg.data.player.playerId);
    expect(marked).toBe(false);

    const player = await repo.getPlayer(gameId, reg.data.player.playerId);
    expect(player.ok && player.value.status).not.toBe("abandoned");
  });
});
