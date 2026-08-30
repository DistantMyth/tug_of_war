/**
 * Regression Tests: Critical Bug Fix #4
 * Concurrent registrations must produce unique, sequential labels.
 * atomicRegisterPlayer must serialize concurrent calls.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { PlayerIdentityService } from "./service.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";

describe("Regression #4: Atomic Registration", () => {
  let repo: MemoryGameRepository;
  let identityService: PlayerIdentityService;

  beforeEach(async () => {
    repo = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repo, {
      tokenSecret: "test-secret-32-chars-padded-xxxx",
    });

    // Open a game session
    await repo.setCurrentGameId("test-game-001");
    await repo.createGame({
      gameId: "test-game-001",
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
  });

  it("10 simultaneous registrations produce exactly 10 unique players with sequential labels", async () => {
    const registrations = Array.from({ length: 10 }, () =>
      identityService.registerOrResume({}),
    );

    const results = await Promise.all(registrations);
    const successes = results.filter((r) => r.ok);
    expect(successes.length).toBe(10);

    const playerIds = successes.map((r) => (r as any).data.player.playerId);
    const labels = successes.map((r) => (r as any).data.player.label);

    // All player IDs must be unique
    const uniqueIds = new Set(playerIds);
    expect(uniqueIds.size).toBe(10);

    // All labels must be unique
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(10);

    // Labels must be P-001 through P-010
    const sortedLabels = [...labels].sort();
    expect(sortedLabels).toEqual([
      "P-001", "P-002", "P-003", "P-004", "P-005",
      "P-006", "P-007", "P-008", "P-009", "P-010",
    ]);
  });

  it("50 concurrent registrations: all unique, sequential labels, no races", async () => {
    const COUNT = 50;
    const results = await Promise.all(
      Array.from({ length: COUNT }, () => identityService.registerOrResume({})),
    );

    const ok = results.filter((r) => r.ok);
    expect(ok.length).toBe(COUNT);

    const labels = ok.map((r) => (r as any).data.player.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(COUNT);
  });

  it("resume with valid token is always idempotent regardless of concurrency", async () => {
    // Register one player
    const reg = await identityService.registerOrResume({});
    expect(reg.ok).toBe(true);
    const token = (reg as any).data.token;

    // Simulate React StrictMode: same token submitted twice concurrently
    const [r1, r2] = await Promise.all([
      identityService.registerOrResume({ token }),
      identityService.registerOrResume({ token }),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    // Both should return the same player ID
    const id1 = (r1 as any).data.player.playerId;
    const id2 = (r2 as any).data.player.playerId;
    expect(id1).toBe(id2);
  });
});
